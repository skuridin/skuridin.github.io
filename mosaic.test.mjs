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
            this.contextLost = false;
        }
        getContext() { return { isContextLost: () => this.contextLost }; }
        dispose() { this.disposed = true; }
        setClearColor() {}
        setPixelRatio(value) { this.pixelRatio = value; }
        setSize() {}
        setRenderTarget(target) { this.target = target; }
        compileAsync() { return compile(hero, this); }
        setAnimationLoop(callback) { this.frame = callback; }
        render(scene, camera) {
            // Like three.js, a lost context draws nothing.
            if (this.contextLost) {
                return;
            }
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
        setContextLost: (lost) => {
            renderer.contextLost = lost;
            canvasListeners[lost ? 'webglcontextlost' : 'webglcontextrestored']();
        },
    };
};

const frame = (page, now) => page.renderer.frame?.(now);

// The height of each vertex of an edge used by only one triangle, which is an opening in the
// shell. Vertices are keyed by position, because a flat tile repeats them so each face keeps
// its own normal.
const openEdgeHeights = (geometry) => {
    const positions = geometry.getAttribute('position');
    const index = geometry.index;
    const faces = index ? index.count : positions.count;
    const cornerOf = (i) => {
        const vertex = index ? index.getX(i) : i;
        return [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)]
            .map((value) => value.toFixed(4))
            .join(',');
    };
    const uses = new Map();
    for (let face = 0; face < faces; face += 3) {
        const corners = [face, face + 1, face + 2].map(cornerOf);
        for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) {
            const key = corners[u] < corners[v] ? `${corners[u]}|${corners[v]}` : `${corners[v]}|${corners[u]}`;
            uses.set(key, (uses.get(key) ?? 0) + 1);
        }
    }
    return [...uses]
        .filter(([, times]) => times === 1)
        .map(([key]) => Number(key.split('|')[0].split(',')[1]));
};

const rowOf = (mesh, name, index) => {
    const attribute = mesh.geometry.getAttribute(name);
    return Array.from(attribute.array.slice(attribute.itemSize * index, attribute.itemSize * (index + 1)));
};

// Attributes store 32-bit values, so compare what the tile will really be given.
const stored = (values) => Array.from(new Float32Array(values));

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
    page.hero.clientWidth = 1440;
    page.hero.clientHeight = 900;
    await resize(page);
    assertComplete(page);
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

test('assembly draws exactly the tiles that have started, in the order they start', async () => {
    const page = await setup({ reduceMotion: false });
    const tiles = tileMeshes(page);
    frame(page, 0);
    assert.ok(tiles.every((mesh) => mesh.count === 0));
    for (const now of [300, 900, 1600, 3400, 10000]) {
        frame(page, now);
        for (const mesh of tiles) {
            const at = mesh.geometry.getAttribute('aAt').array;
            assert.ok(at.every((value, index) => index === 0 || value >= at[index - 1]),
                'Instances must be ordered by the time their tile starts');
            const started = at.filter((start) => start <= page.time.value).length;
            assert.equal(mesh.count, started, 'Draw every tile that has started and no other');
        }
    }
    assertComplete(page);
});

test('tile geometry is a closed solid with its top at 1 and its foot under the mortar', () => {
    // The beveled tile swaps the bevel band that mortar buries for a cap at its foot.
    for (const [geometry, foot] of [[shaders.tesseraGeometry(), 0.06], [shaders.flatTesseraGeometry(), 0]]) {
        const material = new three.MeshStandardMaterial();
        const mesh = new three.Mesh(geometry, material);
        mesh.updateMatrixWorld();
        const fromAbove = new three.Raycaster(new three.Vector3(0, 2, 0), new three.Vector3(0, -1, 0));
        const fromBelow = new three.Raycaster(new three.Vector3(0, -1, 0), new three.Vector3(0, 1, 0));
        assert.ok(Math.abs(fromAbove.intersectObject(mesh)[0]?.point.y - 1) < 1e-6);
        assert.ok(Math.abs(fromBelow.intersectObject(mesh)[0]?.point.y - foot) < 1e-6);
        // The shadow pass draws the back faces, and tiles rise above the mortar while they
        // assemble, so the shell must have no opening anywhere.
        assert.deepEqual(openEdgeHeights(geometry), []);
        geometry.dispose();
        material.dispose();
    }
});

test('a tile carries its shape into whichever batch it lands in', () => {
    const tiles = pattern.build({ radius: 100, pitch: 10, reach: 150, reveal: 300, visible: () => true })
        .slice(0, 4);
    const geometry = shaders.tesseraGeometry();
    const material = new three.MeshStandardMaterial();
    const all = tileData.createTileMesh(tiles, geometry, material, null);
    const sorted = [...tiles].sort((a, b) => a.at - b.at);
    sorted.forEach((tile, index) => {
        assert.deepEqual(rowOf(all, 'aAt', index), stored([tile.at]));
        assert.deepEqual(rowOf(all, 'aCut0', index), stored(tile.cuts.slice(0, 4)));
        assert.deepEqual(rowOf(all, 'aCut1', index), stored(tile.cuts.slice(4)));
        assert.deepEqual(rowOf(all, 'aSeed', index), stored([tile.seed]));
    });
    const alone = tileData.createTileMesh([tiles[2]], geometry, material, null);
    for (const name of ['aCut0', 'aCut1', 'aSeed', 'aAt', 'aGloss']) {
        assert.deepEqual(rowOf(alone, name, 0), rowOf(all, name, sorted.indexOf(tiles[2])));
    }
    geometry.dispose();
    all.geometry.dispose();
    alone.geometry.dispose();
    all.dispose();
    alone.dispose();
    material.dispose();
});

test('tile shapes repeat for the same floor and differ between tiles', () => {
    const built = () => pattern.build({ radius: 100, pitch: 10, reach: 150, reveal: 300, visible: () => true });
    const first = built();
    const second = built();
    const shape = (tile) => [...tile.cuts, tile.seed];
    first.forEach((tile, index) => assert.deepEqual(shape(tile), shape(second[index]),
        'The same floor gets the same shapes'));
    assert.equal(new Set(first.map((tile) => shape(tile).join())).size, first.length, 'Tiles must differ');
    assert.ok(first.every((tile) => tile.cuts.length === 8
        && tile.cuts.every((value) => value >= -0.5 && value < 0.5)
        && tile.seed >= 0 && tile.seed < 64));
});

test('tiles split into one detailed and one blurred mesh per kind', () => {
    const tiles = pattern.build({ radius: 400, pitch: 20, reach: 900, reveal: 300, visible: () => true })
        .filter((tile) => tile.kind === 'smalti');
    const far = (tile) => Math.hypot(tile.x, tile.z) > 200;
    const detailedGeometry = shaders.tesseraGeometry();
    const blurredGeometry = shaders.flatTesseraGeometry();
    const material = new three.MeshStandardMaterial();
    const meshes = tileData.createTileMeshes({
        tiles,
        materials: { smalti: material },
        detailedGeometry,
        blurredGeometry,
        shadowMaterial: null,
        isBlurred: far,
    });
    const triangles = (geometry) => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    const detailed = meshes.find((mesh) => triangles(mesh.geometry) === triangles(detailedGeometry));
    const blurred = meshes.find((mesh) => triangles(mesh.geometry) === triangles(blurredGeometry));
    assert.equal(meshes.length, 2, 'One mesh per detail level');
    assert.equal(detailed.instanceMatrix.count + blurred.instanceMatrix.count, tiles.length,
        'Every tile lands in exactly one batch');
    assert.equal(blurred.instanceMatrix.count, tiles.filter(far).length);
    detailedGeometry.dispose();
    blurredGeometry.dispose();
    meshes.forEach((mesh) => mesh.dispose());
    meshes.forEach(({ geometry }) => geometry.dispose());
    material.dispose();
});

test('simpler geometry stays outside the focus band throughout assembly and camera lean', async () => {
    const page = await setup();
    const triangles = (geometry) => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    const detailedGeometry = shaders.tesseraGeometry();
    const blurredGeometry = shaders.flatTesseraGeometry();
    const { focus, aperture, maxBlur, minBlur } = shaders.LENS;
    const coarse = tileMeshes(page).filter((mesh) => triangles(mesh.geometry) === triangles(blurredGeometry));
    const fine = tileMeshes(page).filter((mesh) => triangles(mesh.geometry) === triangles(detailedGeometry));
    assert.ok(coarse.length > 0 && fine.length > 0);
    const camera = new three.PerspectiveCamera();
    const degree = Math.PI / 180;
    const views = [];
    // Denser than the poses the layout samples, and higher than a tile ever stands, so this
    // checks the choice instead of repeating the estimate that made it.
    for (const x of [-3, -1.5, 0, 1.5, 3]) {
        for (const y of [-4, -2, 0, 2, 4]) {
            // The resting tilt of a wide screen at this size, as layout() sets it.
            const tilt = (62 + x) * degree;
            const up = new three.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
            camera.position.set(0, Math.cos(tilt), Math.sin(tilt)).applyAxisAngle(up, y * degree).multiplyScalar(focus);
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
                    const blur = Math.min(Math.abs(1 - focus / -point.z) * aperture, 1) * maxBlur;
                    assert.ok(blur >= minBlur, `Simplified tile entered focus: ${blur}`);
                }
            }
        }
    }
    detailedGeometry.dispose();
    blurredGeometry.dispose();
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
    page.setContextLost(true);
    assert.equal(page.classes.has('is-ready'), false);
    page.setContextLost(false);
    assert.ok(page.renderer.sceneRenders > renders);
    assert.ok(page.classes.has('is-ready'));
    frame(page, 10032);
    assert.equal(page.renderer.frame, null);
});

test('a resize during context loss shows the new floor when the context returns', async () => {
    const page = await setup({ width: 390, height: 844, reduceMotion: false });
    frame(page, 0);
    page.setContextLost(true);
    page.hero.clientWidth = 1440;
    page.hero.clientHeight = 900;
    await resize(page);
    page.window.scrollY = 100;
    page.listeners.scroll();
    assert.equal(page.renderer.frame, null);
    page.setContextLost(false);
    frame(page, 10000);
    assertComplete(page);
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
