import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as three from './vendor/three.min.js';
import * as pattern from './mosaic-pattern.js';
import * as shaders from './mosaic-shaders.js';

const module = await readFile(new URL('./mosaic.js', import.meta.url), 'utf8');
// The vm runs a script, so the three.js import becomes globals of the context.
const source = module.replace(/^import [\s\S]*? from '[^']+';\n/gm, '');
assert.notEqual(source, module, 'mosaic.js no longer starts with the three.js import');

const setup = async ({ width = 1000, height = 700, reduceMotion = true, floatSupport = true, finePointer = false, compile = async () => {} } = {}) => {
    const listeners = {};
    const classes = new Set();
    const hero = {
        clientWidth: width, clientHeight: height,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    const canvas = {
        closest: () => hero,
        addEventListener() {},
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
            }
        }
    }
    const context = vm.createContext({
        ...three,
        ...pattern,
        ...shaders,
        WebGLRenderer: Renderer,
        document: { querySelector: () => canvas },
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
            constructor(callback) { this.callback = callback; }
            observe() { this.callback([{ isIntersecting: true }]); }
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
    return { renderer, time, settleMs: TILE_SETTLE_MS, hero, listeners, classes, errors, window: context.window };
};

const resize = async (page) => {
    page.listeners.resize();
    await new Promise((resolve) => setTimeout(resolve, 175));
};

const tileMeshes = ({ renderer }) => renderer.scene.children.filter((mesh) => mesh.isInstancedMesh);

const assertComplete = (page) => {
    const tiles = tileMeshes(page);
    assert.ok(tiles.some((mesh) => mesh.count > 0));
    for (const mesh of tiles) {
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
    const tileAt = (x, z) => tileMeshes(page).some(({ count, instanceMatrix: { array } }) => {
        for (let index = 0; index < count; index += 1) {
            if (Math.hypot(array[index * 16 + 12] - x, array[index * 16 + 14] - z) < 40) {
                return true;
            }
        }
        return false;
    });
    assert.equal(tileAt(-7083.290787380882, -1380.234941933337), true);
});

test('animation renders a complete final frame, then stops scene updates', async () => {
    const page = await setup({ reduceMotion: false });
    page.renderer.frame(0);
    page.renderer.frame(3400);
    const renders = page.renderer.sceneRenders;
    page.renderer.frame(10000);
    assert.ok(page.renderer.sceneRenders > renders);
    assertComplete(page);
    const finalRenders = page.renderer.sceneRenders;
    page.renderer.frame(11000);
    assert.equal(page.renderer.sceneRenders, finalRenders);
});

test('scrolling leans a settled floor, then lets the scene rest again', async () => {
    const page = await setup({ reduceMotion: false });
    page.renderer.frame(0);
    page.renderer.frame(10000);
    page.renderer.frame(10100);
    const settled = page.renderer.sceneRenders;
    page.window.scrollY = 350;
    page.listeners.scroll();
    page.renderer.frame(10200);
    assert.ok(page.renderer.sceneRenders > settled);
    for (let now = 10300; now < 20000; now += 16) {
        page.renderer.frame(now);
    }
    const leaned = page.renderer.sceneRenders;
    page.renderer.frame(20100);
    assert.equal(page.renderer.sceneRenders, leaned);
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
    page.renderer.frame(0);
    page.renderer.frame(10000);
    page.renderer.frame(10100);
    const settled = page.renderer.sceneRenders;
    page.window.scrollY = -60;
    page.listeners.scroll();
    page.renderer.frame(10200);
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
    page.renderer.frame(0);
    page.renderer.frame(10000);
    page.listeners.pointermove({ clientX: 900, clientY: 300 });
    for (let now = 10016; now < 20000; now += 16) {
        page.renderer.frame(now);
    }
    const settled = page.renderer.totalRenders;
    page.renderer.frame(20100);
    assert.equal(page.renderer.totalRenders, settled);
    page.listeners.pointermove({ clientX: 100, clientY: 300 });
    page.renderer.frame(20116);
    assert.ok(page.renderer.totalRenders > settled);
});

test('a resize recalculates scroll lean without another scroll event', async () => {
    const page = await setup({ reduceMotion: false });
    page.renderer.frame(0);
    page.window.scrollY = 350;
    page.listeners.scroll();
    page.hero.clientHeight = 1400;
    await resize(page);
    for (let now = 10000; now < 20000; now += 16) page.renderer.frame(now);

    const reference = await setup({ height: 1400, reduceMotion: false });
    reference.renderer.frame(0);
    reference.window.scrollY = 350;
    reference.listeners.scroll();
    for (let now = 10000; now < 20000; now += 16) reference.renderer.frame(now);
    assert.ok(page.renderer.camera.position.distanceTo(reference.renderer.camera.position) < 0.001);
});
