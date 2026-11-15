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

// A unit tessera standing on y = 0: a flat top with clipped corners and a softened,
// smooth-shaded edge, so the raking light draws a thin bright rim on every tile. A tile
// without a bevel keeps its vertices apart instead, which keeps its faces flat.
export const tesseraGeometry = (bevelSegments = 2) => {
    const beveled = bevelSegments > 0;
    const half = beveled ? 0.42 : 0.5;
    // Match the widest outline of the beveled tile when using a flat prism.
    const corner = beveled ? 0.05 : 0.05 + 0.08 * (2 - Math.SQRT2);
    const bevelThickness = beveled ? 0.06 : 0;
    const shape = new Shape()
        .moveTo(-half + corner, -half)
        .lineTo(half - corner, -half)
        .lineTo(half, -half + corner)
        .lineTo(half, half - corner)
        .lineTo(half - corner, half)
        .lineTo(-half + corner, half)
        .lineTo(-half, half - corner)
        .lineTo(-half, -half + corner);
    let geometry = new ExtrudeGeometry(shape, {
        depth: beveled ? 0.88 : 1,
        bevelEnabled: beveled,
        bevelThickness,
        bevelSize: 0.08,
        bevelSegments,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bevelThickness, 0);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    if (beveled) {
        // Sharing vertices lets each one carry the average of the faces around it, which is
        // what turns the bevel into one continuous softened edge.
        geometry = mergeVertices(geometry);
        geometry.computeVertexNormals();
        dropBuriedFaces(geometry, bevelThickness);
    } else {
        // Nothing is shared here, so these normals are the face normals: flat sides.
        geometry.computeVertexNormals();
    }
    return geometry;
};

// Drops the band of bevel faces that mortar covers once a tile settles. The band it removes
// leaves the shell open below `bandTop`, which is safe because the mortar plane stands above
// it. The bottom cap stays, because shadows need a solid tile while tiles rise. Normals are
// left as they were computed, so the faces that stay shade exactly as before.
const dropBuriedFaces = (geometry, bandTop) => {
    const positions = geometry.getAttribute('position');
    const exposed = [];
    for (let face = 0; face < geometry.index.count; face += 3) {
        const corners = [face, face + 1, face + 2].map((corner) => geometry.index.getX(corner));
        const top = Math.max(...corners.map((corner) => positions.getY(corner)));
        if (top < 1e-6 || top > bandTop + 1e-6) {
            exposed.push(...corners);
        }
    }
    geometry.setIndex(exposed);
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

// Sharp pixels where the lens is in focus, bokeh elsewhere, then a lens vignette, the tone curve and film grain.
export const COMPOSITE_FRAGMENT = `
    ${DEPTH_OF_FIELD}
    uniform sampler2D uColor;
    uniform sampler2D uBokeh;
    uniform vec2 uBokehTexel;
    uniform float uMaxBlur;
    uniform vec2 uVignette;
    uniform float uGrain;
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
        // Film grain shows most in the shadows and mid-tones, least in the highlights.
        highp vec2 cell = gl_FragCoord.xy + uGrain * vec2(37.0, 17.0);
        float grain = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb += grain * 0.07 * (1.0 - luma * 0.7);
    }`;
