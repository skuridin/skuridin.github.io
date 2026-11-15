import { Color, InstancedBufferAttribute, InstancedMesh, Object3D, SRGBColorSpace } from './vendor/three.min.js';
import { LENS } from './mosaic-shaders.js';

// Chooses the tiles that stay outside the focus band for every camera pose, so they can use
// simpler geometry. `views` are the camera views between the resting pose and the pointer
// extremes, and the slack says how far the tiles and the camera can move around them.
export const blurClassifier = (views, { lean, shadowRatio }) => (tile) => {
    // A sphere wide enough to still cover the tile when the camera leans to any sampled
    // pose, when a tile is raised to its full height while assembling, and when its shadow
    // lies across the mortar beside it.
    const radius = Math.hypot(tile.depth, tile.length) * 0.65
        + tile.height * (Math.hypot(4 * shadowRatio, 2) + 1)
        + Math.hypot(tile.x, tile.z) * (1 - Math.cos(lean));
    let near = Infinity;
    let far = -Infinity;
    for (const view of views) {
        const e = view.elements;
        // Measured at twice the tile height, so a raised tile stays inside the band too.
        const depth = -(e[2] * tile.x + e[6] * tile.height * 2 + e[10] * tile.z + e[14]);
        near = Math.min(near, depth - radius);
        far = Math.max(far, depth + radius);
    }
    if (near <= 0 || (near <= LENS.focus && far >= LENS.focus)) {
        return false;
    }
    const confusion = Math.min(Math.abs(1 - LENS.focus / near), Math.abs(1 - LENS.focus / far));
    return confusion * LENS.aperture * LENS.maxBlur >= LENS.minBlur;
};

const byStart = (a, b) => a.at - b.at;

// One mesh per tile kind and detail level. Tiles that never come into focus share the
// simpler geometry, so each batch keeps its own instances and shape buffers.
export const createTileMeshes = ({ tiles, materials, detailedGeometry, blurredGeometry, shadowMaterial, isBlurred }) => {
    const meshes = [];
    for (const [kind, material] of Object.entries(materials)) {
        const detailed = [];
        const blurred = [];
        tiles.forEach((tile) => {
            if (tile.kind === kind) (isBlurred(tile) ? blurred : detailed).push(tile);
        });
        for (const [batch, geometry] of [[detailed, detailedGeometry], [blurred, blurredGeometry]]) {
            if (batch.length) {
                meshes.push(createTileMesh(batch, geometry, material, shadowMaterial));
            }
        }
    }
    return meshes;
};

// One batch of tesserae. Each tile carries its own `cuts` and `seed` from the pattern, so a
// tile keeps its shape whichever batch it lands in.
export const createTileMesh = (tiles, geometry, material, shadowMaterial) => {
    // Instances are ordered by the time their tile starts, so the tiles that have begun to
    // appear are always a prefix of the mesh.
    const order = tiles.slice().sort(byStart);
    const mesh = new InstancedMesh(geometry.clone(), material, order.length);
    const dummy = new Object3D();
    const color = new Color();
    const at = new Float32Array(order.length);
    const gloss = new Float32Array(order.length);
    const nearCuts = new Float32Array(order.length * 4);
    const farCuts = new Float32Array(order.length * 4);
    const seed = new Float32Array(order.length);
    order.forEach((tile, index) => {
        dummy.position.set(tile.x, 0, tile.z);
        dummy.rotation.set(tile.tipX, -tile.angle, tile.tipZ);
        dummy.scale.set(tile.depth, tile.height, tile.length);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.setRGB(...tile.color.map((value) => value / 255), SRGBColorSpace));
        at[index] = tile.at;
        gloss[index] = tile.gloss;
        // aCut0 holds the near corners and aCut1 the far ones, in the order tile.cuts lists them.
        nearCuts.set(tile.cuts.slice(0, 4), index * 4);
        farCuts.set(tile.cuts.slice(4), index * 4);
        seed[index] = tile.seed;
    });
    mesh.geometry.setAttribute('aAt', new InstancedBufferAttribute(at, 1));
    mesh.geometry.setAttribute('aGloss', new InstancedBufferAttribute(gloss, 1));
    mesh.geometry.setAttribute('aCut0', new InstancedBufferAttribute(nearCuts, 4));
    mesh.geometry.setAttribute('aCut1', new InstancedBufferAttribute(farCuts, 4));
    mesh.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
    mesh.customDepthMaterial = shadowMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Tiles grow from zero scale, so the bounds of the finished floor are the ones that count.
    mesh.frustumCulled = false;
    return mesh;
};

export const revealTiles = (mesh, time) => {
    // `aAt` is sorted, so the tiles that have started to appear are a prefix.
    const at = mesh.geometry.getAttribute('aAt').array;
    let count = mesh.count;
    while (count < at.length && at[count] <= time) {
        count += 1;
    }
    while (count > 0 && at[count - 1] > time) {
        count -= 1;
    }
    mesh.count = count;
};
