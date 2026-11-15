import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as three from './vendor/three.min.js';
import * as pattern from './mosaic-pattern.js';
import * as shaders from './mosaic-shaders.js';
import * as tileData from './mosaic-tiles.js';

const module = await readFile(new URL('./mosaic.js', import.meta.url), 'utf8');
// The vm runs a script, so the three.js import becomes globals of the context.
const source = module.replace(/^import [\s\S]*? from '[^']+';\n/gm, '');
assert.notEqual(source, module, 'mosaic.js no longer starts with the three.js import');

const setup = async ({ width = 1000, height = 700, reduceMotion = true, floatSupport = true, finePointer = false, compile = async () => {} } = {}) => {
    const listeners = {};
    const canvasListeners = {};
    const classes = new Set();
    const hero = {
        clientWidth: width, clientHeight: height,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    const canvas = {
        closest: () => hero,
        addEventListener: (name, callback) => { canvasListeners[name] = callback; },
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    };
    let renderer;
    class Renderer {
        constructor() {
            renderer = this;
            this.extensions = { has: () => floatSupport };
            this.shadowMap = {};
            this.debug = {};
            this.sceneRenders = 0;
            this.totalRenders = 0;
            this.shadowRenders = 0;
        }
        dispose() { this.disposed = true; }
        setClearColor() {}
        setPixelRatio(value) { this.pixelRatio = value; }
        setSize() {}
        setRenderTarget(target) { this.target = target; }
        compileAsync() { return compile(hero, this); }
        setAnimationLoop(callback) { this.frame = callback; }
        render(scene, camera) {
            this.totalRenders += 1;
            if (scene.isScene) {
                this.scene = scene;
                this.camera = camera;
                this.sceneTarget = this.target;
                this.sceneRenders += 1;
                this.shadowRenders += Number(this.shadowMap.needsUpdate);
            }
        }
    }
    let intersection;
    const document = {
        hidden: false,
        querySelector: () => canvas,
        addEventListener: (name, callback) => { listeners[name] = callback; },
    };
    const context = vm.createContext({
        ...three,
        ...pattern,
        ...shaders,
        ...tileData,
        sampleTileShapes: (renderer, _camera, count) => {
            renderer.shapeSamples = (renderer.shapeSamples || 0) + 1;
            return Float32Array.from({ length: count * 9 }, (_, index) => index % 9 / 9);
        },
        WebGLRenderer: Renderer,
        document,
        window: {
            scrollY: 0,
            devicePixelRatio: 1,
            matchMedia: (query) => ({
                matches: (reduceMotion && query.includes('reduced-motion')) || (finePointer && query.includes('pointer: fine')),
                addEventListener: (name, callback) => { listeners[query] = callback; },
            }),
            addEventListener: (name, callback) => { listeners[name] = callback; },
        },
        IntersectionObserver: class {
            constructor(callback) { intersection = callback; }
            observe() { intersection([{ isIntersecting: true }]); }
        },
        requestAnimationFrame() {},
        performance,
        setTimeout,
        clearTimeout,
        console: { error: (error) => errors.push(error) },
    });
    const errors = [];
    shaders.time.value = 0;
    const { start, time, TILE_SETTLE_MS } = vm.runInContext(`${source}\n({ start, time, TILE_SETTLE_MS });`, context);
    await start();
    return {
        renderer, time, settleMs: TILE_SETTLE_MS, hero, listeners, canvasListeners, classes, errors, document,
        window: context.window,
        intersect: (isIntersecting) => intersection([{ isIntersecting }]),
    };
};

const frame = (page, now) => page.renderer.frame?.(now);

const resize = async (page) => {
    page.listeners.resize();
    await new Promise((resolve) => setTimeout(resolve, 175));
};

const tileMeshes = ({ renderer }) => renderer.scene.children.filter((mesh) => mesh.isInstancedMesh);

const assertComplete = (page) => {
    const tiles = tileMeshes(page);
    assert.ok(tiles.some((mesh) => mesh.count > 0));
    for (const mesh of tiles) {
        assert.equal(mesh.count, mesh.instanceMatrix.count, 'The complete floor must draw every tile');
        for (const at of mesh.geometry.getAttribute('aAt').array) {
            const end = at + page.settleMs;
            assert.ok(page.time.value >= end, `Tile ends at ${end}, scene stopped at ${page.time.value}`);
        }
    }
};

test('reduced motion shows all tiles, including after a mobile-to-desktop resize', async () => {
    const page = await setup({ width: 390, height: 844 });
    assertComplete(page);
    assert.equal(page.renderer.shapeSamples, 1);
    page.hero.clientWidth = 1440;
    page.hero.clientHeight = 900;
    await resize(page);
    assertComplete(page);
    assert.equal(page.renderer.shapeSamples, 2);
    assert.ok(page.classes.has('is-ready'));
});

test('reduced-motion resize keeps existing meshes when dimensions do not change', async () => {
    const page = await setup({ width: 390, height: 844 });
    const meshes = tileMeshes(page);
    const renders = page.renderer.sceneRenders;
    await resize(page);
    assert.ok(tileMeshes(page).every((mesh, index) => mesh === meshes[index]));
    assert.equal(page.renderer.sceneRenders, renders);
});

test('4K pointer lean retains tiles that start outside the resting view', async () => {
    const page = await setup({ width: 3840, height: 2160, reduceMotion: false });
    // Tiles here are about 55 units apart; without the lean views the nearest one is a full gap away.
    const tileAt = (x, z) => tileMeshes(page).some(({ instanceMatrix: { array, count } }) => {
        for (let index = 0; index < count; index += 1) {
            if (Math.hypot(array[index * 16 + 12] - x, array[index * 16 + 14] - z) < 40) {
                return true;
            }
        }
        return false;
    });
    assert.equal(tileAt(-7083.290787380882, -1380.234941933337), true);
});

test('assembly draws all started tiles without drawing the unused instance tail', async () => {
    const page = await setup({ reduceMotion: false });
    const tiles = tileMeshes(page);
    frame(page, 0);
    assert.ok(tiles.every((mesh) => mesh.count === 0));
    let outOfOrder = false;
    for (const now of [300, 900, 1600, 3400, 10000]) {
        frame(page, now);
        for (const mesh of tiles) {
            const at = mesh.geometry.getAttribute('aAt').array;
            outOfOrder ||= at.some((value, index) => index > 0 && value < at[index - 1]);
            const lastStarted = at.findLastIndex((start) => start <= page.time.value);
            assert.equal(mesh.count, lastStarted + 1);
        }
    }
    assert.ok(outOfOrder, 'Cover tiles that start before an earlier instance');
    assertComplete(page);
});

test('tile geometry retains top and bottom caps for solid shadows during assembly', () => {
    for (const segments of [2, 0]) {
        const geometry = shaders.tesseraGeometry(segments);
        const material = new three.MeshStandardMaterial();
        const mesh = new three.Mesh(geometry, material);
        mesh.updateMatrixWorld();
        const fromAbove = new three.Raycaster(new three.Vector3(0, 2, 0), new three.Vector3(0, -1, 0));
        const fromBelow = new three.Raycaster(new three.Vector3(0, -1, 0), new three.Vector3(0, 1, 0));
        assert.ok(Math.abs(fromAbove.intersectObject(mesh)[0]?.point.y - 1) < 1e-6);
        assert.ok(Math.abs(fromBelow.intersectObject(mesh)[0]?.point.y) < 1e-6);
        geometry.dispose();
        material.dispose();
    }
});

test('tile shapes stay the same when tiles move into a different batch', () => {
    const tiles = pattern.build({ radius: 100, pitch: 10, reach: 150, reveal: 300, visible: () => true })
        .slice(0, 4).map((tile, id) => ({ ...tile, id }));
    const shapes = Float32Array.from({ length: 36 }, (_, index) => (index + 1) / 37);
    const geometry = shaders.tesseraGeometry();
    const material = new three.MeshStandardMaterial();
    const all = tileData.createTileMesh(tiles, geometry, material, null, shapes);
    const split = tileData.createTileMesh([tiles[3]], geometry, material, null, shapes);
    for (const name of ['aCut0', 'aCut1', 'aSeed', 'aAt', 'aGloss']) {
        const original = all.geometry.getAttribute(name);
        assert.deepEqual(split.geometry.getAttribute(name).array, original.array.slice(original.itemSize * 3, original.itemSize * 4));
    }
    geometry.dispose();
    all.geometry.dispose();
    split.geometry.dispose();
    all.dispose();
    split.dispose();
    material.dispose();
});

test('shape sampling restores renderer state and disposes resources if rendering fails', () => {
    const previous = {};
    const disposed = [];
    let target = previous;
    let dithering = true;
    const gl = { DITHER: 1, isEnabled: () => dithering, disable: () => { dithering = false; }, enable: () => { dithering = true; } };
    const renderer = {
        getRenderTarget: () => target,
        getContext: () => gl,
        setRenderTarget: (next) => {
            target = next;
            if (next !== previous) next.addEventListener('dispose', () => disposed.push('target'));
        },
        render: (mesh) => {
            mesh.geometry.addEventListener('dispose', () => disposed.push('geometry'));
            mesh.material.addEventListener('dispose', () => disposed.push('material'));
            throw new Error('sampling failed');
        },
    };
    assert.throws(() => tileData.sampleTileShapes(renderer, {}, 1), /sampling failed/);
    assert.equal(target, previous);
    assert.equal(dithering, true);
    assert.deepEqual(disposed, ['target', 'geometry', 'material']);
});

test('shape sampling decodes float bytes and rejects data from a lost context', () => {
    const expected = Float32Array.from([0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.1, 0.2]);
    let lost = false;
    let target = null;
    const renderer = {
        getRenderTarget: () => target,
        setRenderTarget: (next) => { target = next; },
        getContext: () => ({ DITHER: 1, isEnabled: () => false, disable() {}, isContextLost: () => lost }),
        render() {},
        readRenderTargetPixels: (_target, _x, _y, _width, _height, bytes) => {
            const view = new DataView(bytes.buffer);
            expected.forEach((value, index) => view.setFloat32(index * 4, value, true));
        },
    };
    assert.deepEqual(tileData.sampleTileShapes(renderer, {}, 1), expected);
    assert.equal(target, null);
    lost = true;
    assert.throws(() => tileData.sampleTileShapes(renderer, {}, 1), /context lost/);
    assert.equal(target, null);
});

test('simpler geometry stays outside the focus band throughout assembly and camera lean', async () => {
    const page = await setup();
    const coarse = tileMeshes(page).filter((mesh) => mesh.geometry.index.count / 3 < 60);
    const fine = tileMeshes(page).filter((mesh) => mesh.geometry.index.count / 3 === 60);
    assert.ok(coarse.length > 0 && fine.length > 0);
    const camera = new three.PerspectiveCamera();
    const degree = Math.PI / 180;
    const views = [];
    for (const x of [-3, -1.5, 0, 1.5, 3]) {
        for (const y of [-4, -2, 0, 2, 4]) {
            const tilt = (62 + x) * degree;
            const up = new three.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
            camera.position.set(0, Math.cos(tilt), Math.sin(tilt)).applyAxisAngle(up, y * degree).multiplyScalar(1100);
            camera.up.copy(up);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            views.push(camera.matrixWorldInverse.clone());
        }
    }
    for (const mesh of coarse) {
        const { array, count } = mesh.instanceMatrix;
        for (let index = 0; index < count; index++) {
            const offset = index * 16;
            const x = array[offset + 12];
            const z = array[offset + 14];
            const height = Math.hypot(array[offset + 4], array[offset + 5], array[offset + 6]);
            for (const view of views) {
                for (const y of [0, height * 4]) {
                    const point = new three.Vector3(x, y, z).applyMatrix4(view);
                    const blur = Math.min(Math.abs(1 - 1100 / -point.z) * 1.4, 1) * 24;
                    assert.ok(blur >= 6, `Simplified tile entered focus: ${blur}`);
                }
            }
        }
    }
});

test('animation renders a complete final frame, then stops scene updates', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    frame(page, 3400);
    const renders = page.renderer.sceneRenders;
    frame(page, 10000);
    assert.ok(page.renderer.sceneRenders > renders);
    assertComplete(page);
    const finalRenders = page.renderer.sceneRenders;
    frame(page, 11000);
    assert.equal(page.renderer.sceneRenders, finalRenders);
    assert.equal(page.renderer.frame, null);
});

test('scrolling leans a settled floor, then lets the scene rest again', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    frame(page, 10000);
    frame(page, 10100);
    const settled = page.renderer.sceneRenders;
    page.window.scrollY = 350;
    page.listeners.scroll();
    assert.equal(typeof page.renderer.frame, 'function');
    frame(page, 10200);
    assert.ok(page.renderer.sceneRenders > settled);
    for (let now = 10300; now < 20000; now += 16) {
        frame(page, now);
    }
    const leaned = page.renderer.sceneRenders;
    frame(page, 20100);
    assert.equal(page.renderer.sceneRenders, leaned);
    assert.equal(page.renderer.frame, null);
});

test('4K targets stay within the pixel budget', async () => {
    const page = await setup({ width: 3840, height: 2160 });
    const { width, height } = page.renderer.sceneTarget;
    assert.ok(page.renderer.pixelRatio < 1);
    assert.ok(width * height <= 3.21e6);
    assertComplete(page);
});

test('missing float targets keep the fallback and release the renderer', async () => {
    const page = await setup({ floatSupport: false });
    assert.equal(page.renderer.disposed, true);
    assert.equal(page.renderer.sceneRenders, 0);
    assert.equal(page.classes.has('is-ready'), false);
});

test('a resize while shaders compile is applied before the first frame', async () => {
    let resized = false;
    const page = await setup({
        width: 390,
        height: 844,
        compile: async (hero) => {
            if (!resized) {
                resized = true;
                hero.clientWidth = 844;
                hero.clientHeight = 390;
            }
        },
    });
    assert.deepEqual([page.renderer.sceneTarget.width, page.renderer.sceneTarget.height], [844, 390]);
});

test('a density change with the same CSS size renders at the new pixel ratio', async () => {
    const page = await setup();
    assert.equal(page.renderer.pixelRatio, 1);
    page.window.devicePixelRatio = 2;
    page.listeners['(resolution: 1dppx)']();
    await new Promise((resolve) => setTimeout(resolve, 175));
    assert.equal(page.renderer.pixelRatio, 1.5);
    assert.equal(page.renderer.shapeSamples, 1);
});

test('a resize updates the shadow projection to the new light distance', async () => {
    const page = await setup({ width: 390, height: 844 });
    page.hero.clientWidth = 1440;
    page.hero.clientHeight = 900;
    await resize(page);
    const { camera } = page.renderer.scene.children.find((child) => child.isSpotLight).shadow;
    const used = camera.projectionMatrix.clone();
    camera.updateProjectionMatrix();
    assert.deepEqual(used.elements, camera.projectionMatrix.elements);
});

test('a failed setup keeps the fallback and releases the renderer', async () => {
    const page = await setup({ compile: async () => { throw new Error('compile failed'); } });
    assert.equal(page.renderer.disposed, true);
    assert.equal(page.errors.length, 1);
    assert.equal(page.classes.has('is-ready'), false);
});

test('overscroll above the top does not lean the floor', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    frame(page, 10000);
    frame(page, 10100);
    const settled = page.renderer.sceneRenders;
    page.window.scrollY = -60;
    page.listeners.scroll();
    frame(page, 10200);
    assert.equal(page.renderer.sceneRenders, settled);
});

test('a shader link error keeps the fallback and releases the renderer', async () => {
    const page = await setup({ compile: async (_hero, renderer) => {
        renderer.debug.onShaderError({ getProgramInfoLog: () => 'link failed' }, {});
    } });
    assert.equal(page.renderer.disposed, true);
    assert.ok(page.errors.length > 0);
    assert.equal(page.classes.has('is-ready'), false);
});

test('a stationary pointer lets every render pass rest after leaning', async () => {
    const page = await setup({ reduceMotion: false, finePointer: true });
    frame(page, 0);
    frame(page, 10000);
    const shadows = page.renderer.shadowRenders;
    page.listeners.pointermove({ clientX: 900, clientY: 300 });
    for (let now = 10016; now < 20000; now += 16) {
        frame(page, now);
    }
    const settled = page.renderer.totalRenders;
    frame(page, 20100);
    assert.equal(page.renderer.totalRenders, settled);
    assert.equal(page.renderer.frame, null);
    page.listeners.pointermove({ clientX: 100, clientY: 300 });
    assert.equal(typeof page.renderer.frame, 'function');
    frame(page, 20116);
    assert.ok(page.renderer.totalRenders > settled);
    assert.equal(page.renderer.shadowRenders, shadows);
});

test('pointer leave restarts the loop and returns the floor to its scroll position', async () => {
    const page = await setup({ reduceMotion: false, finePointer: true });
    frame(page, 0);
    frame(page, 10000);
    const rest = page.renderer.camera.position.clone();
    page.listeners.pointermove({ clientX: 900, clientY: 300 });
    for (let now = 10016; now < 20000; now += 16) frame(page, now);
    assert.equal(page.renderer.frame, null);
    assert.ok(page.renderer.camera.position.distanceTo(rest) > 1);
    page.listeners.pointerleave();
    assert.equal(typeof page.renderer.frame, 'function');
    for (let now = 20000; now < 30000; now += 16) frame(page, now);
    assert.equal(page.renderer.frame, null);
    assert.ok(page.renderer.camera.position.distanceTo(rest) < 0.3);
});

test('resize restarts a resting loop and completes the new floor', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    frame(page, 10000);
    frame(page, 10016);
    assert.equal(page.renderer.frame, null);
    const renders = page.renderer.sceneRenders;
    page.hero.clientWidth = 1440;
    await resize(page);
    assert.equal(typeof page.renderer.frame, 'function');
    frame(page, 11000);
    frame(page, 11016);
    assert.ok(page.renderer.sceneRenders > renders);
    assertComplete(page);
    assert.equal(page.renderer.frame, null);
});

test('offscreen input does not restart the loop; return renders the current scroll position', async () => {
    const page = await setup({ reduceMotion: false, finePointer: true });
    frame(page, 0);
    const rest = page.renderer.camera.position.clone();
    page.intersect(false);
    assert.equal(page.renderer.frame, null);
    page.listeners.pointermove({ clientX: 900, clientY: 300 });
    page.listeners.pointerleave();
    page.window.scrollY = 350;
    page.listeners.scroll();
    page.hero.clientWidth = 1200;
    await resize(page);
    assert.equal(page.renderer.frame, null);
    page.intersect(true);
    for (let now = 10000; now < 20000; now += 16) frame(page, now);
    assertComplete(page);
    assert.equal(page.renderer.frame, null);
    assert.ok(page.renderer.camera.position.distanceTo(rest) > 1);
});

test('a hidden document stops the loop and resumes incomplete assembly when visible', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    page.document.hidden = true;
    page.listeners.visibilitychange();
    page.window.scrollY = 100;
    page.listeners.scroll();
    page.intersect(true);
    assert.equal(page.renderer.frame, null);
    page.document.hidden = false;
    page.listeners.visibilitychange();
    assert.equal(typeof page.renderer.frame, 'function');
    frame(page, 100);
    assert.notEqual(page.renderer.frame, null);
    for (let now = 10000; now < 20000; now += 16) frame(page, now);
    assertComplete(page);
    assert.equal(page.renderer.frame, null);
    page.intersect(false);
    page.document.hidden = true;
    page.listeners.visibilitychange();
    page.document.hidden = false;
    page.listeners.visibilitychange();
    assert.equal(page.renderer.frame, null);
});

test('context restoration redraws a resting floor', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    frame(page, 10000);
    frame(page, 10016);
    assert.equal(page.renderer.frame, null);
    const renders = page.renderer.sceneRenders;
    page.canvasListeners.webglcontextlost();
    assert.equal(page.classes.has('is-ready'), false);
    page.canvasListeners.webglcontextrestored();
    assert.ok(page.renderer.sceneRenders > renders);
    assert.ok(page.classes.has('is-ready'));
    frame(page, 10032);
    assert.equal(page.renderer.frame, null);
});

test('a resize during context loss waits to sample tile data until restoration', async () => {
    const page = await setup({ width: 390, height: 844, reduceMotion: false });
    frame(page, 0);
    page.canvasListeners.webglcontextlost();
    page.hero.clientWidth = 1440;
    page.hero.clientHeight = 900;
    await resize(page);
    page.window.scrollY = 100;
    page.listeners.scroll();
    assert.equal(page.renderer.frame, null);
    assert.equal(page.renderer.shapeSamples, 1);
    assert.equal(page.renderer.sceneTarget.width, 390);
    page.canvasListeners.webglcontextrestored();
    frame(page, 10000);
    assertComplete(page);
    assert.equal(page.renderer.shapeSamples, 2);
    assert.equal(page.renderer.sceneTarget.width, 1440);
    assert.ok(page.classes.has('is-ready'));
});

test('a resize recalculates scroll lean without another scroll event', async () => {
    const page = await setup({ reduceMotion: false });
    frame(page, 0);
    page.window.scrollY = 350;
    page.listeners.scroll();
    page.hero.clientHeight = 1400;
    await resize(page);
    for (let now = 10000; now < 20000; now += 16) frame(page, now);

    const reference = await setup({ height: 1400, reduceMotion: false });
    frame(reference, 0);
    reference.window.scrollY = 350;
    reference.listeners.scroll();
    for (let now = 10000; now < 20000; now += 16) frame(reference, now);
    assert.ok(page.renderer.camera.position.distanceTo(reference.renderer.camera.position) < 0.001);
});
