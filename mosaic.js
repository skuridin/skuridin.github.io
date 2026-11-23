import {
    BackSide,
    Color,
    DepthTexture,
    HalfFloatType,
    HemisphereLight,
    InstancedMesh,
    Mesh,
    MeshDepthMaterial,
    MeshStandardMaterial,
    NeutralToneMapping,
    PCFShadowMap,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    Scene,
    ShaderMaterial,
    SpotLight,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    WebGLRenderer,
} from './vendor/three.min.js';
import { build } from './mosaic-pattern.js';
import { blurClassifier, createTileMeshes, revealTiles } from './mosaic-tiles.js';
import { BOKEH_FRAGMENT, COMPOSITE_FRAGMENT, FULLSCREEN_VERTEX, LENS, TILE_SETTLE_MS, flatTesseraGeometry, mortarMaterial, tesseraGeometry, tesseraMaterial, time } from './mosaic-shaders.js';

const canvas = document.querySelector('.mosaic');
const hero = canvas && canvas.closest('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const INK = '#061614';
// The camera orbits the emblem at the focus distance, so the emblem is the sharp part.
const DISTANCE = LENS.focus;
const LEAN = { x: 3, y: 4 };
const DEGREE = Math.PI / 180;
const LIGHT_FROM = new Vector3(0.85, 0.5, -0.2).normalize();
// How far a tile can move in view depth around the sampled camera poses: the camera leans
// this far, and a tile's shadow stretches this far across the mortar.
const BLUR_SLACK = {
    lean: Math.hypot(LEAN.x, LEAN.y) * DEGREE,
    shadowRatio: Math.hypot(LIGHT_FROM.x, LIGHT_FROM.z) / LIGHT_FROM.y,
};

// At most about 3.2 million pixels per pass, so large high-DPI screens do not multiply the GPU work.
const pixelRatioFor = (width, height) => Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(3.2e6 / (width * height)));

const start = async () => {
    let renderer;
    try {
        // The canvas only shows the composite pass, so it needs no depth buffer.
        renderer = new WebGLRenderer({ canvas, depth: false });
    } catch {
        // The CSS gradient on .hero-art stays as the fallback.
        return;
    }
    if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
        renderer.dispose();
        return;
    }
    let shaderFailed = false;
    renderer.debug.onShaderError = (gl, program) => {
        shaderFailed = true;
        canvas.classList.remove('is-ready');
        console.error('Mosaic shader failed:', gl.getProgramInfoLog(program));
    };
    renderer.setClearColor(INK);
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    // The light is fixed, so the shadow map changes only while the tiles move.
    renderer.shadowMap.autoUpdate = false;

    const tessera = tesseraGeometry();
    const flatTessera = flatTesseraGeometry();
    const materials = {
        stone: tesseraMaterial(new MeshStandardMaterial({ roughness: 0.75 })),
        smalti: tesseraMaterial(new MeshStandardMaterial({ roughness: 0.55 })),
        gold: tesseraMaterial(new MeshStandardMaterial({ metalness: 0.35, roughness: 0.4, emissive: '#2a1a04' })),
    };
    // The shadow pass draws back faces; setting that up front lets the program compile before the first frame.
    const shadowMaterial = tesseraMaterial(new MeshDepthMaterial({ side: BackSide }));

    const scene = new Scene();
    // Each step of the setup runs in its own task, so the page stays responsive while the hero loads.
    const yieldToMain = () => new Promise((resolve) => setTimeout(resolve));
    await yieldToMain();
    // A dim sky and floor bounce fill the shadows; an environment map would cost a long shader compile.
    scene.add(new HemisphereLight('#ffe7c4', '#0b2a30', 0.35));

    const camera = new PerspectiveCamera(45, 1, 50, 8000);
    const floor = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mortarMaterial());
    floor.receiveShadow = true;
    scene.add(floor);

    // One warm key light; its soft-edged pool is what falls off into the dark corners.
    const key = new SpotLight('#ffd6a6', 0, 0, 0.5, 1, 0);
    key.castShadow = true;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.5;
    scene.add(key, key.target);

    const sceneTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    sceneTarget.depthTexture = new DepthTexture(1, 1);
    const bokehTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    const lens = {
        uDepth: { value: sceneTarget.depthTexture },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uFocus: { value: DISTANCE },
        uAperture: { value: LENS.aperture },
        uColor: { value: sceneTarget.texture },
        uMaxBlur: { value: 1 },
    };
    const bokeh = new ShaderMaterial({
        uniforms: { ...lens, uTexel: { value: new Vector2() } },
        vertexShader: FULLSCREEN_VERTEX,
        fragmentShader: BOKEH_FRAGMENT,
        depthTest: false,
        depthWrite: false,
    });
    const composite = new ShaderMaterial({
        uniforms: {
            ...lens,
            uMaxBlur: { value: 1 },
            uBokeh: { value: bokehTarget.texture },
            uBokehTexel: { value: new Vector2() },
            uVignette: { value: new Vector2(0.7, 0.55) },
        },
        vertexShader: FULLSCREEN_VERTEX,
        fragmentShader: COMPOSITE_FRAGMENT,
        depthTest: false,
        depthWrite: false,
    });
    const screen = new Mesh(new PlaneGeometry(2, 2), bokeh);
    screen.frustumCulled = false;

    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const groundAt = (x, y, out) => {
        raycaster.setFromCamera(ndc.set(x, y), camera);
        const { origin, direction } = raycaster.ray;
        if (direction.y >= -1e-4) {
            return null;
        }
        return out.copy(direction).multiplyScalar(-origin.y / direction.y).add(origin);
    };

    const pointer = { x: 0, y: 0, active: false };
    // From 0 to 1 over the first half of the hero's scroll, while most of the mosaic is still on screen.
    let scrolled = 0;
    let view;
    let meshes = [];
    // Overscroll above the top must not tip the floor the other way.
    const measureScroll = () => {
        scrolled = Math.min(Math.max(window.scrollY, 0) / (view.height / 2), 1);
    };

    // Orbits the camera around the emblem: `x` tips the floor back, `y` turns it sideways.
    const aim = ({ x, y }) => {
        const up = new Vector3(0, Math.sin(x * DEGREE), -Math.cos(x * DEGREE));
        camera.position.set(0, Math.cos(x * DEGREE), Math.sin(x * DEGREE)).applyAxisAngle(up, y * DEGREE).multiplyScalar(DISTANCE);
        camera.up.copy(up);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
    };

    const layout = (width, height) => {
        const wide = width > 800;
        const pixelRatio = pixelRatioFor(width, height);
        const shadowSize = wide ? 2048 : 1024;
        if (key.shadow.mapSize.x !== shadowSize) {
            key.shadow.mapSize.set(shadowSize, shadowSize);
            key.shadow.map?.dispose();
            key.shadow.map = null;
        }
        const pixels = [Math.round(width * pixelRatio), Math.round(height * pixelRatio)];
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        // On dense screens the pixels themselves smooth the edges, so 2 samples are enough.
        const samples = pixelRatio > 1 ? 2 : 4;
        if (sceneTarget.samples !== samples) {
            sceneTarget.samples = samples;
            sceneTarget.dispose();
        }
        sceneTarget.setSize(...pixels);
        bokehTarget.setSize(Math.ceil(pixels[0] / 2), Math.ceil(pixels[1] / 2));
        bokeh.uniforms.uTexel.value.set(2 / pixels[0], 2 / pixels[1]);
        composite.uniforms.uBokehTexel.value.set(2 / pixels[0], 2 / pixels[1]);
        // The bokeh pass counts in half-resolution pixels of the blur the lens asks for.
        bokeh.uniforms.uMaxBlur.value = (LENS.maxBlur * pixelRatio) / 2;
        composite.uniforms.uMaxBlur.value = LENS.maxBlur * pixelRatio;

        // A low macro view: the floor tips far back and the emblem fills the frame.
        const rest = { x: wide ? 62 : 56, y: 0 };
        camera.fov = (2 * Math.atan(height / 2 / DISTANCE)) / DEGREE;
        camera.aspect = width / height;
        // Shift the frame so the emblem sits right of the name on wide screens and above it on narrow ones.
        const focus = wide ? { x: 0.8, y: 0.48 } : { x: 0.55, y: 0.32 };
        camera.setViewOffset(width, height, width * (0.5 - focus.x), height * (0.5 - focus.y), width, height);
        composite.uniforms.uVignette.value.set(focus.x, 1 - focus.y);

        const radius = wide ? width * 0.72 : width * 1.6;
        const pitch = radius / 50;
        // Where the camera can be: the resting pose and the four extremes of the pointer lean.
        const poses = [[0, 0], [-LEAN.x, -LEAN.y], [-LEAN.x, LEAN.y], [LEAN.x, -LEAN.y], [LEAN.x, LEAN.y]]
            .map(([x, y]) => {
                aim({ x: rest.x + x, y: rest.y + y });
                return {
                    view: camera.matrixWorldInverse.clone(),
                    projection: camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse),
                    // Where this pose frames the floor.
                    ground: [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([nx, ny]) => groundAt(nx, ny, new Vector3())),
                };
            });
        aim(rest);
        const far = radius * 2.4;
        const reach = Math.min(far, Math.max(...poses.flatMap(({ ground }) => ground)
            .map((corner) => (corner ? corner.length() : far)))) * 1.1;

        // Keep the tiles visible from rest or any pointer extreme, with room for their edges.
        const probe = new Vector3();
        const tiles = build({
            radius,
            reach,
            pitch,
            reveal: Math.hypot(width, height),
            visible: (x, z) => poses.some(({ projection }) => {
                probe.set(x, 0, z).applyMatrix4(projection);
                return Math.abs(probe.x) < 1.15 && Math.abs(probe.y) < 1.15;
            }),
        });

        meshes.forEach((mesh) => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.dispose();
        });
        meshes = createTileMeshes({
            tiles,
            materials,
            detailedGeometry: tessera,
            blurredGeometry: flatTessera,
            shadowMaterial,
            isBlurred: blurClassifier(poses.map(({ view }) => view), BLUR_SLACK),
        });
        meshes.forEach((mesh) => scene.add(mesh));

        floor.scale.set(reach * 3, 1, reach * 3);
        floor.position.y = pitch * 0.12;

        const lightDistance = radius * 2.2;
        Object.assign(key, { angle: Math.atan(radius / lightDistance), penumbra: 1, intensity: 10 });
        key.shadow.camera.near = lightDistance * 0.3;
        key.shadow.camera.far = lightDistance * 2.5;
        // three.js refreshes the shadow projection only when the cone or `far` changes, and the cone never does.
        key.shadow.camera.updateProjectionMatrix();
        key.position.copy(LIGHT_FROM).multiplyScalar(lightDistance);
        key.target.position.set(0, 0, 0);
        key.target.updateMatrixWorld();
        const finishAt = Math.ceil(tiles.reduce((end, tile) => Math.max(end, tile.at + TILE_SETTLE_MS), 0));
        view = { width, height, pixelRatio, rest, lean: { ...rest }, finishAt, dirty: true };
        measureScroll();
    };

    // Renders the scene only when something in it moved.
    const render = () => {
        const { width, height, rest, lean } = view;

        // The pointer leans the floor a little; without one, scrolling does. The light stays where it is.
        const goal = pointer.active
            ? { x: rest.x - (pointer.y / height - 0.5) * 2 * LEAN.x, y: rest.y + (pointer.x / width - 0.5) * 2 * LEAN.y }
            : { x: rest.x + scrolled * LEAN.x, y: rest.y + scrolled * LEAN.y };
        const leaning = Math.abs(goal.x - lean.x) > 0.01 || Math.abs(goal.y - lean.y) > 0.01;
        if (leaning) {
            lean.x += (goal.x - lean.x) * 0.05;
            lean.y += (goal.y - lean.y) * 0.05;
        }
        // Keep rendering until one frame shows the settled floor, however slow the frames are.
        const settling = !view.settled;
        if (!view.dirty && !settling && !leaning) {
            return false;
        }

        for (const mesh of meshes) {
            revealTiles(mesh, time.value);
        }
        aim(lean);
        renderer.shadowMap.needsUpdate = view.dirty || settling;
        view.dirty = false;
        view.settled = time.value >= view.finishAt;
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, camera);
        screen.material = bokeh;
        renderer.setRenderTarget(bokehTarget);
        renderer.render(screen, camera);
        screen.material = composite;
        renderer.setRenderTarget(null);
        renderer.render(screen, camera);
        return settling || leaning;
    };

    const size = () => [hero.clientWidth, hero.clientHeight];
    let startAt;
    let shown = false;
    const show = () => {
        shown = true;
        if (!shaderFailed) {
            canvas.classList.add('is-ready');
        }
    };

    // Only the intersection observer sets this, and it runs only when motion is allowed.
    let visible = false;
    const frame = (now) => {
        if (startAt === undefined) {
            startAt = now;
            show();
        }
        time.value = now - startAt;
        // Stop callbacks as well as drawing when the floor is still.
        if (!render()) {
            renderer.setAnimationLoop(null);
        }
    };
    // Runs frames while the hero can be seen and drawn. A frame stops the loop itself once the
    // floor is still, and anything that can move it calls this again.
    const syncLoop = () => {
        const drawable = visible && !document.hidden && !renderer.getContext().isContextLost();
        renderer.setAnimationLoop(drawable ? frame : null);
    };

    // Lays the floor out again only when the hero size or the screen density changed.
    const relayout = () => {
        const [width, height] = size();
        if (width === view.width && height === view.height && pixelRatioFor(width, height) === view.pixelRatio) {
            return;
        }
        layout(width, height);
        if (reduceMotion) {
            time.value = view.finishAt;
            render();
        } else if (startAt !== undefined) {
            // A floor that was already shown appears complete instead of assembling again.
            startAt = Math.min(startAt, performance.now() - view.finishAt);
        }
        syncLoop();
    };

    try {
        await yieldToMain();
        layout(...size());
        await yieldToMain();
        // Compile shaders off the main thread, for the targets they really render into.
        renderer.setRenderTarget(sceneTarget);
        await renderer.compileAsync(scene, camera);
        // The shadow pass draws the tiles with their depth material; a stand-in tile compiles that program too.
        const shadowCaster = new InstancedMesh(tessera, shadowMaterial, 1);
        shadowCaster.setColorAt(0, new Color());
        await renderer.compileAsync(shadowCaster, camera, scene);
        renderer.setRenderTarget(bokehTarget);
        screen.material = bokeh;
        await renderer.compileAsync(screen, camera);
        renderer.setRenderTarget(null);
        screen.material = composite;
        await renderer.compileAsync(screen, camera);
        // The hero can change size while the shaders compile.
        relayout();
        // One hidden frame uploads the buffers, so the first visible frame does not stall.
        render();
        if (shaderFailed) {
            renderer.dispose();
            return;
        }
    } catch (error) {
        // The CSS gradient on .hero-art stays as the fallback.
        renderer.dispose();
        console.error(error);
        return;
    }

    // If the GPU drops the context, the CSS fallback shows until three.js restores it.
    canvas.addEventListener('webglcontextlost', () => {
        syncLoop();
        canvas.classList.remove('is-ready');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        view.dirty = true;
        view.settled = false;
        render();
        syncLoop();
        if (shown && !shaderFailed) {
            canvas.classList.add('is-ready');
        }
    });

    let resizeTimer;
    const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayout, 150);
    };
    window.addEventListener('resize', onResize);
    // A window moved to a screen of another density keeps its CSS size, so no resize event comes.
    const watchDensity = () => {
        window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
            .addEventListener('change', () => {
                onResize();
                watchDensity();
            }, { once: true });
    };
    watchDensity();

    if (reduceMotion) {
        time.value = view.finishAt;
        view.dirty = true;
        render();
        show();
        return;
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncLoop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', syncLoop);

    // Touch screens have no hover, so the floor follows the scroll while the pointer is away.
    window.addEventListener('scroll', () => {
        measureScroll();
        syncLoop();
    }, { passive: true });

    if (window.matchMedia('(pointer: fine)').matches) {
        hero.addEventListener('pointermove', (event) => {
            const rect = hero.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;
            syncLoop();
        });
        hero.addEventListener('pointerleave', () => {
            pointer.active = false;
            syncLoop();
        });
    }
};

// The hero text paints first; the mosaic starts when the browser has a free moment.
if (hero) {
    requestAnimationFrame(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(start, { timeout: 1500 });
        } else {
            setTimeout(start);
        }
    });
}
