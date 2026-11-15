import { Color, InstancedBufferAttribute, InstancedMesh, Mesh, Object3D, PlaneGeometry, SRGBColorSpace, ShaderMaterial, WebGLRenderTarget } from './vendor/three.min.js';
import { FULLSCREEN_VERTEX } from './mosaic-shaders.js';

// Bake the original GPU hash once. RGBA bytes preserve its float bits without a float readback extension.
export const sampleTileShapes = (renderer, camera, count) => {
    const width = 256;
    const height = Math.ceil(count * 9 / width);
    const target = new WebGLRenderTarget(width, height, { depthBuffer: false });
    const material = new ShaderMaterial({
        vertexShader: FULLSCREEN_VERTEX,
        fragmentShader: `
            const float offsets[9] = float[9](0.11, 0.23, 0.37, 0.41, 0.53, 0.67, 0.71, 0.89, 0.97);
            void main() {
                int index = int(gl_FragCoord.y) * ${width} + int(gl_FragCoord.x);
                float id = float(index / 9);
                float value = fract(sin(id + offsets[index % 9]) * 43758.5453);
                uint bits = floatBitsToUint(value);
                gl_FragColor = vec4(bits & 255u, (bits >> 8u) & 255u, (bits >> 16u) & 255u, bits >> 24u) / 255.0;
            }`,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
    });
    const screen = new Mesh(new PlaneGeometry(2, 2), material);
    screen.frustumCulled = false;
    const previous = renderer.getRenderTarget();
    const gl = renderer.getContext();
    const dither = gl.isEnabled(gl.DITHER);
    try {
        gl.disable(gl.DITHER);
        renderer.setRenderTarget(target);
        renderer.render(screen, camera);
        const bytes = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, bytes);
        if (gl.isContextLost()) {
            throw new Error('WebGL context lost while sampling tile shapes');
        }
        const view = new DataView(bytes.buffer);
        return Float32Array.from({ length: count * 9 }, (_, index) => view.getFloat32(index * 4, true));
    } finally {
        if (dither) {
            gl.enable(gl.DITHER);
        }
        renderer.setRenderTarget(previous);
        target.dispose();
        screen.geometry.dispose();
        material.dispose();
    }
};

export const tileIsBlurred = (tile, views, { focus, aperture, maxBlur, minBlur, lean, shadowRatio }) => {
    // Cover the raised tile, its shadow, and camera angles between the sampled poses.
    const radius = Math.hypot(tile.depth, tile.length) * 0.65
        + tile.height * (Math.hypot(4 * shadowRatio, 2) + 1)
        + Math.hypot(tile.x, tile.z) * (1 - Math.cos(lean));
    let near = Infinity;
    let far = -Infinity;
    for (const view of views) {
        const e = view.elements;
        const depth = -(e[2] * tile.x + e[6] * tile.height * 2 + e[10] * tile.z + e[14]);
        near = Math.min(near, depth - radius);
        far = Math.max(far, depth + radius);
    }
    if (near <= 0 || (near <= focus && far >= focus)) {
        return false;
    }
    const confusion = Math.min(Math.abs(1 - focus / near), Math.abs(1 - focus / far));
    return confusion * aperture * maxBlur >= minBlur;
};

export const createTileMesh = (tiles, geometry, material, shadowMaterial, shapes) => {
    const mesh = new InstancedMesh(geometry.clone(), material, tiles.length);
    const dummy = new Object3D();
    const color = new Color();
    const at = new Float32Array(tiles.length);
    const gloss = new Float32Array(tiles.length);
    const cuts = [new Float32Array(tiles.length * 4), new Float32Array(tiles.length * 4)];
    const seed = new Float32Array(tiles.length);
    tiles.forEach((tile, index) => {
        dummy.position.set(tile.x, 0, tile.z);
        dummy.rotation.set(tile.tipX, -tile.angle, tile.tipZ);
        dummy.scale.set(tile.depth, tile.height, tile.length);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.setRGB(...tile.color.map((value) => value / 255), SRGBColorSpace));
        at[index] = tile.at;
        gloss[index] = tile.gloss;
        for (let corner = 0; corner < 8; corner++) {
            cuts[corner >> 2][index * 4 + corner % 4] = shapes[tile.id * 9 + corner] - 0.5;
        }
        seed[index] = shapes[tile.id * 9 + 8] * 64;
    });
    mesh.geometry.setAttribute('aAt', new InstancedBufferAttribute(at, 1));
    mesh.geometry.setAttribute('aGloss', new InstancedBufferAttribute(gloss, 1));
    mesh.geometry.setAttribute('aCut0', new InstancedBufferAttribute(cuts[0], 4));
    mesh.geometry.setAttribute('aCut1', new InstancedBufferAttribute(cuts[1], 4));
    mesh.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
    // A later tile can start first. Keep a prefix that includes every started instance.
    const revealAt = new Float32Array(at.length);
    let first = Infinity;
    for (let index = at.length - 1; index >= 0; index--) {
        first = Math.min(first, at[index]);
        revealAt[index] = first;
    }
    mesh.userData.revealAt = revealAt;
    mesh.customDepthMaterial = shadowMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
};

export const revealTiles = (mesh, time) => {
    const revealAt = mesh.userData.revealAt;
    while (mesh.count > 0 && revealAt[mesh.count - 1] > time) {
        mesh.count -= 1;
    }
    while (mesh.count < revealAt.length && revealAt[mesh.count] <= time) {
        mesh.count += 1;
    }
};
