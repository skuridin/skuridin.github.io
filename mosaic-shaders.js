import { ExtrudeGeometry, MeshStandardMaterial, Shape, mergeVertices } from './vendor/three.min.js';

// The virtual lens, shared by the bokeh pass and by the estimate that picks which tiles can
// use simpler geometry, so a tile's real blur and the predicted one always agree.
export const LENS = {
    // The camera orbits the emblem at this distance, so the emblem is the sharp part.
    focus: 1100,
    aperture: 1.4,
    // The largest blur, in CSS pixels. The bokeh pass works at half resolution.
    maxBlur: 24,
    // Below this many CSS pixels of blur a tile no longer resolves, so simpler edges hide.
    minBlur: 6,
};

export const TILE_SETTLE_MS = 450;

const BEVEL_SIZE = 0.08;
const BEVEL_THICKNESS = 0.06;

// An octagon of the given half width with clipped corners, extruded up the y axis from y = 0.
const extrudeOutline = (half, corner, options) => {
    const shape = new Shape()
        .moveTo(-half + corner, -half)
        .lineTo(half - corner, -half)
        .lineTo(half, -half + corner)
        .lineTo(half, half - corner)
        .lineTo(half - corner, half)
        .lineTo(-half + corner, half)
        .lineTo(-half, half - corner)
        .lineTo(-half, -half + corner);
    const geometry = new ExtrudeGeometry(shape, options);
    geometry.rotateX(-Math.PI / 2);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    return geometry;
};

// A unit tessera: a flat top with clipped corners and a softened, smooth-shaded edge, so the
// raking light draws a thin bright rim on every tile.
export const tesseraGeometry = () => {
    const extruded = extrudeOutline(0.5 - BEVEL_SIZE, 0.05, {
        depth: 1 - 2 * BEVEL_THICKNESS,
        bevelEnabled: true,
        bevelThickness: BEVEL_THICKNESS,
        bevelSize: BEVEL_SIZE,
        bevelSegments: 2,
    }).translate(0, BEVEL_THICKNESS, 0);
    // Sharing vertices lets each one carry the average of the faces around it, which is what
    // turns the bevel into one continuous softened edge.
    const geometry = mergeVertices(extruded);
    geometry.computeVertexNormals();
    capBuriedBand(geometry, BEVEL_THICKNESS);
    return geometry;
};

// The same tessera as a plain prism, for tiles too blurred to show the bevel. Its outline
// matches the widest one of the beveled tile, and nothing is shared between faces, so the
// computed normals are the face normals: flat sides.
export const flatTesseraGeometry = () => {
    const geometry = extrudeOutline(0.5, 0.05 + BEVEL_SIZE * (2 - Math.SQRT2), { depth: 1, bevelEnabled: false });
    geometry.computeVertexNormals();
    return geometry;
};

// Mortar always covers the bottom bevel band of a settled tile, so it is replaced, with the
// cap under it, by one cap across the foot of the side wall. The tile stays a closed solid,
// which the back-face shadow pass and the camera both need while it rises above the mortar.
// Normals are left as they were computed, so the faces that stay shade exactly as before.
const capBuriedBand = (geometry, bandTop) => {
    const positions = geometry.getAttribute('position');
    const faces = [];
    for (let face = 0; face < geometry.index.count; face += 3) {
        const corners = [face, face + 1, face + 2].map((corner) => geometry.index.getX(corner));
        if (Math.max(...corners.map((corner) => positions.getY(corner))) > bandTop + 1e-6) {
            faces.push(...corners);
        }
    }
    // The outline is convex, so a fan around the foot ring closes it. Ordered by angle in the
    // xz plane, the fan faces down.
    const angle = (vertex) => Math.atan2(positions.getZ(vertex), positions.getX(vertex));
    const ring = Array.from({ length: positions.count }, (_, vertex) => vertex)
        .filter((vertex) => Math.abs(positions.getY(vertex) - bandTop) < 1e-6)
        .sort((a, b) => angle(a) - angle(b));
    for (let index = 1; index < ring.length - 1; index += 1) {
        faces.push(ring[0], ring[index], ring[index + 1]);
    }
    geometry.setIndex(faces);
};

// Value noise for the hand-made surface detail of tiles and mortar.
const NOISE = `
    float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
    }`;

const TESSERA_VERTEX = `#include <begin_vertex>
    // Hand-cut: every corner moves a little, so no two tesserae share a shape.
    vec2 cut = transformed.xz + 0.5;
    transformed.xz += mix(mix(aCut0.xy, aCut0.zw, cut.x), mix(aCut1.xy, aCut1.zw, cut.x), cut.y) * 0.22;
    vLocal = transformed;
    vSeed = aSeed;
    vGloss = aGloss;
    // Tiles grow out of the mortar and settle at their \`at\` time.
    float settle = 1.0 - pow(1.0 - clamp((uTime - aAt) / ${TILE_SETTLE_MS.toFixed(1)}, 0.0, 1.0), 3.0);
    transformed *= settle;
    transformed.y += (1.0 - settle) * 4.0;`;

const TESSERA_FRAGMENT = {
    '#include <color_fragment>': `#include <color_fragment>
        // How much of a tile one pixel covers; distant tiles lose fine detail instead of sparkling.
        float footprint = length(fwidth(vLocal.xz));
        float detail = 1.0 - smoothstep(0.08, 0.35, footprint);
        // One gate covers every fine sample below, and the three terms keep their neutral
        // values when it is closed, so a distant tile costs the same as an untextured one.
        float mottle = 1.0;
        float textureRoughness = 0.0;
        vec3 bump = vec3(0.0);
        if (detail > 0.0) {
            mottle = 1.0 - 0.3 * smoothstep(0.7, 0.85, noise3(vLocal * 9.0 + vSeed)) * detail;
            textureRoughness = (noise3(vLocal * 6.0 + vSeed) - 0.5) * 0.25 * detail;
            // A granular, pitted top that the raking light picks out.
            vec3 grain = vLocal * vec3(4.0, 2.0, 4.0) + vSeed;
            bump = (vec3(noise3(grain), noise3(grain + 19.1), noise3(grain + 37.7)) - 0.5) * detail;
        }
        // Stone and smalti are mottled and flecked with darker grains,
        // and the sides darken where they go down into the mortar.
        diffuseColor.rgb *= 0.82 + 0.36 * noise3(vLocal * 2.5 + vSeed);
        diffuseColor.rgb *= mottle;
        diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(0.15, 0.8, vLocal.y));`,
    '#include <roughnessmap_fragment>': `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.3, 0.7, vGloss) + textureRoughness, 0.05, 1.0);
        roughnessFactor = max(roughnessFactor, footprint * 1.2);`,
    '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
        normal = normalize(normal + bump * 0.35);`,
};

export const time = { value: 0 };

export const tesseraMaterial = (material) => {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute float aAt;
                attribute float aGloss;
                attribute vec4 aCut0;
                attribute vec4 aCut1;
                attribute float aSeed;
                uniform float uTime;
                varying vec3 vLocal;
                varying float vSeed;
                varying float vGloss;`)
            .replace('#include <begin_vertex>', TESSERA_VERTEX);
        shader.fragmentShader = Object.entries(TESSERA_FRAGMENT).reduce(
            (source, [chunk, patch]) => source.replace(chunk, patch),
            shader.fragmentShader.replace('#include <common>', `#include <common>
                varying vec3 vLocal;
                varying float vSeed;
                varying float vGloss;
                ${NOISE}`),
        );
    };
    return material;
};

// Sand-and-lime mortar: rough and mottled, set high enough to bury the tile bases.
export const mortarMaterial = () => {
    const material = new MeshStandardMaterial({ color: '#1e2624', roughness: 1 });
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = (modelMatrix * vec4(transformed, 1.0)).xz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying vec2 vFloor;\n${NOISE}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                diffuseColor.rgb *= 0.7 + 0.35 * noise3(vec3(vFloor * 0.08, 0.0)) + 0.25 * noise3(vec3(vFloor * 0.9, 3.0));`);
    };
    return material;
};

export const FULLSCREEN_VERTEX = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }`;

// Thin-lens circle of confusion from the depth buffer, as a share of the largest blur.
const DEPTH_OF_FIELD = `
    #include <packing>
    uniform sampler2D uDepth;
    uniform float uNear;
    uniform float uFar;
    uniform float uFocus;
    uniform float uAperture;
    float sceneDepth(vec2 uv) {
        return -perspectiveDepthToViewZ(texture2D(uDepth, uv).r, uNear, uFar);
    }
    float confusion(float depth) {
        return clamp(abs(1.0 - uFocus / depth) * uAperture, 0.0, 1.0);
    }`;

// Disc bokeh, gathered at half resolution along a golden-angle spiral.
// HDR highlights spread into bright discs, as they do through a real lens.
export const BOKEH_FRAGMENT = `
    ${DEPTH_OF_FIELD}
    uniform sampler2D uColor;
    uniform vec2 uTexel;
    uniform float uMaxBlur;
    varying vec2 vUv;
    void main() {
        float centerDepth = sceneDepth(vUv);
        float centerSize = confusion(centerDepth) * uMaxBlur;
        vec3 color = texture2D(uColor, vUv).rgb;
        float total = 1.0;
        // A random start angle per pixel turns the spiral's pattern into fine grain.
        float start = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
        for (int i = 0; i < 24; i++) {
            float angle = start + float(i) * 2.39996323;
            float radius = uMaxBlur * sqrt((float(i) + 1.0) / 24.0);
            vec2 uv = vUv + vec2(cos(angle), sin(angle)) * uTexel * radius;
            float depth = sceneDepth(uv);
            float size = confusion(depth) * uMaxBlur;
            // Sharp background must not bleed over a blurred foreground.
            if (depth > centerDepth) {
                size = min(size, centerSize * 2.0);
            }
            color += mix(color / total, texture2D(uColor, uv).rgb, smoothstep(radius - 0.5, radius + 0.5, size));
            total += 1.0;
        }
        gl_FragColor = vec4(color / total, 1.0);
    }`;

// Ordered dithering of the final image. Each channel is reduced to `levels` steps, and the 8x8 Bayer matrix
// decides which pixels take the step up, so a tone between two steps becomes a regular weave instead of a band.
// A cell is `cell` canvas pixels wide, because one pixel is too fine to read as a pattern. Its size on screen
// follows the canvas pixel ratio that `pixelRatioFor` in mosaic.js picks.
const DITHER = { levels: 16, cell: 3 };

// The threshold of the 8x8 Bayer matrix for a canvas pixel, from 0 to 1. The matrix is [[0, 2], [3, 1]]
// stacked three deep: the lowest bit pair of the cell's coordinates picks the largest digit of its index.
const BAYER = `
    // 0, 2, 3, 1 for 00, 10, 01, 11: twice x xor y, plus y.
    float bayerCell(vec2 bits) {
        return 2.0 * (bits.x + bits.y - 2.0 * bits.x * bits.y) + bits.y;
    }
    float bayer(highp vec2 pixel) {
        pixel = floor(pixel / ${DITHER.cell.toFixed(1)});
        vec2 low = mod(pixel, 2.0);
        vec2 middle = mod(floor(pixel * 0.5), 2.0);
        vec2 high = mod(floor(pixel * 0.25), 2.0);
        return (16.0 * bayerCell(low) + 4.0 * bayerCell(middle) + bayerCell(high)) / 64.0;
    }`;

// Sharp pixels where the lens is in focus, bokeh elsewhere, then a lens vignette, the tone curve and ordered
// dithering.
export const COMPOSITE_FRAGMENT = `
    ${DEPTH_OF_FIELD}
    ${BAYER}
    uniform sampler2D uColor;
    uniform sampler2D uBokeh;
    uniform vec2 uBokehTexel;
    uniform float uMaxBlur;
    uniform vec2 uVignette;
    varying vec2 vUv;
    void main() {
        float blur = confusion(sceneDepth(vUv)) * uMaxBlur;
        // A small tent filter smooths the grain left by the randomly turned spiral.
        vec3 bokeh = texture2D(uBokeh, vUv).rgb * 0.4;
        bokeh += texture2D(uBokeh, vUv + uBokehTexel * vec2(1.0, 1.0)).rgb * 0.15;
        bokeh += texture2D(uBokeh, vUv + uBokehTexel * vec2(-1.0, 1.0)).rgb * 0.15;
        bokeh += texture2D(uBokeh, vUv + uBokehTexel * vec2(1.0, -1.0)).rgb * 0.15;
        bokeh += texture2D(uBokeh, vUv + uBokehTexel * vec2(-1.0, -1.0)).rgb * 0.15;
        vec3 color = mix(texture2D(uColor, vUv).rgb, bokeh, smoothstep(0.5, 2.0, blur));
        vec2 offset = (vUv - uVignette) * vec2(1.0, 0.8);
        color *= 1.0 - smoothstep(0.3, 1.2, length(offset)) * 0.8;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // Ordered dithering of the display values: where the threshold of a cell reaches a channel's distance to
        // the tone above, the pixel takes that tone, so a tone in between becomes a weave that keeps its brightness.
        float threshold = bayer(gl_FragCoord.xy);
        gl_FragColor.rgb = floor(gl_FragColor.rgb * ${DITHER.levels.toFixed(1)} + threshold) / ${DITHER.levels.toFixed(1)};
    }`;
