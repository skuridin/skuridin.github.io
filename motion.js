'use strict';

(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduceMotion && 'IntersectionObserver' in window) {
        document.documentElement.classList.add('js');
        const observer = new IntersectionObserver((entries) => {
            entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
                // Items entering together reveal in sequence.
                entry.target.style.transitionDelay = `${index * 90}ms`;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        document.querySelectorAll('.reveal').forEach((item) => observer.observe(item));
    }

    const canvas = document.querySelector('.mosaic');
    const context = canvas && canvas.getContext('2d');
    if (!context || !window.DOMMatrix) {
        return;
    }

    const INK = '#061614';
    const COLORS = {
        paper: [236, 229, 214],
        vermilion: [214, 78, 28],
        petrol: [5, 57, 76],
        petrolMid: [22, 85, 103],
        petrolLight: [48, 118, 136],
        gold: [216, 156, 44],
    };
    // Rings of the emblem as [outer edge in emblem radii, color]; 'band' and 'rays' are laid differently.
    const ZONES = [
        [0.17, 'paper'],
        [0.29, 'vermilion'],
        [0.38, 'paper'],
        [0.6, 'petrol'],
        [0.7, 'band'],
        [Infinity, 'rays'],
    ];
    const BAND = ['paper', 'paper', 'gold'];
    const RAYS = ['petrolMid', 'petrol', 'petrolLight', 'gold', 'petrol', 'petrolMid', 'vermilion', 'petrol',
        'petrolLight', 'petrolMid', 'gold', 'petrol', 'petrolLight', 'petrol'];
    const ASSEMBLE_MS = 2400;
    const PERSPECTIVE = 1100;

    // Seeded so the pattern stays the same between visits and resizes.
    const seeded = (seed) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // How strongly each material catches the light.
    const GLOSS = { paper: 0.9, gold: 1, vermilion: 0.55, petrol: 0.4, petrolMid: 0.45, petrolLight: 0.5 };

    const rgb = (channels, scale = 1, lift = 0) =>
        `rgb(${channels.map((value) => Math.min(255, Math.round(value * scale + lift))).join(' ')})`;

    const tint = (name, random) => {
        const light = 0.78 + random() * 0.4;
        return COLORS[name].map((value) => value * light + (random() - 0.5) * 18);
    };

    // The canvas is a tilted floor: perspective, then turns in degrees around x, y and z.
    const tiltMatrix = ({ x, y, z }) => {
        const matrix = new DOMMatrix();
        matrix.m34 = -1 / PERSPECTIVE;
        return matrix.rotate(x, 0, 0).rotate(0, y, 0).rotate(0, 0, z);
    };

    // Maps a point in hero coordinates back onto the tilted canvas plane.
    const toCanvas = (matrix, heroX, heroY) => {
        const halfWidth = canvas.clientWidth / 2;
        const halfHeight = canvas.clientHeight / 2;
        const px = heroX - canvas.offsetLeft - halfWidth;
        const py = heroY - canvas.offsetTop - halfHeight;
        const { m11, m12, m14, m21, m22, m24, m41, m42, m44 } = matrix;
        const a1 = m11 - px * m14;
        const b1 = m21 - px * m24;
        const c1 = px * m44 - m41;
        const a2 = m12 - py * m14;
        const b2 = m22 - py * m24;
        const c2 = py * m44 - m42;
        const det = a1 * b2 - a2 * b1;
        return { x: (c1 * b2 - c2 * b1) / det + halfWidth, y: (a1 * c2 - a2 * c1) / det + halfHeight };
    };

    const build = (width, height, { cx, cy, radius, pitch, reveal }) => {
        const random = seeded(11);
        const reach = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + pitch;
        const grout = pitch * 0.45;
        const tiles = [];

        const lay = (r, count, depth, colorAt) => {
            const offset = random() * Math.PI * 2;
            const arc = (Math.PI * 2 * r) / count;
            for (let index = 0; index < count; index += 1) {
                const angle = offset + (index * Math.PI * 2) / count + ((random() - 0.5) * arc * 0.12) / r;
                const name = colorAt(angle, index);
                if (!name) {
                    continue;
                }
                tiles.push({
                    x: cx + Math.cos(angle) * r,
                    y: cy + Math.sin(angle) * r,
                    angle: angle + (random() - 0.5) * 0.08,
                    depth: depth * (0.74 + random() * 0.14),
                    length: arc * (0.74 + random() * 0.14),
                    color: tint(name, random),
                    gloss: GLOSS[name] * random() ** 2.5,
                    warm: name === 'gold',
                    at: (r / reveal) * ASSEMBLE_MS + random() * 300,
                });
            }
        };

        const rayAt = (r) => (angle) => {
            const turn = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
            const position = turn * RAYS.length;
            const fromEdge = Math.min(position % 1, 1 - (position % 1)) * ((Math.PI * 2 * r) / RAYS.length);
            return fromEdge < grout ? null : RAYS[Math.floor(position)];
        };

        let inner = 0;
        ZONES.forEach(([edge, name]) => {
            const outer = Math.min(edge * radius, reach);
            const start = inner === 0 ? 0 : inner + grout;
            const span = outer - start;
            inner = outer;
            if (span <= 0) {
                return;
            }
            if (name === 'band') {
                const r = start + span / 2;
                lay(r, Math.round((Math.PI * 2 * r) / (span * 1.5)), span, (_, index) => BAND[index % BAND.length]);
                return;
            }
            const rows = Math.max(1, Math.round(span / pitch));
            const step = span / rows;
            for (let row = 0; row < rows; row += 1) {
                const r = start + step * (row + 0.5);
                const count = Math.max(3, Math.round((Math.PI * 2 * r) / step));
                lay(r, count, step, name === 'rays' ? rayAt(r) : () => name);
            }
        });
        tiles.sort((a, b) => a.at - b.at);

        const flecks = Array.from({ length: Math.round((width * height) / 7000) }, () => ({
            x: random() * width,
            y: random() * height,
            size: 1.2 + random() * 2.4,
            phase: random() * Math.PI * 2,
            speed: 0.0006 + random() * 0.0014,
        }));

        return { tiles, flecks, cx, cy, width, height, laid: 0 };
    };

    const layer = () => document.createElement('canvas').getContext('2d');
    const baseContext = layer();
    // Sheen is soft, so it lives at 1x to save memory on large screens.
    const sheenContext = layer();
    const glowContext = layer();
    const base = baseContext.canvas;
    const hero = canvas.closest('.hero');
    const light = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0, active: false };
    let scene;
    let ratio = 1;
    let rest;
    let tilt;

    const setup = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (scene && scene.width === width && scene.height === height) {
            return false;
        }
        const heroWidth = hero.clientWidth;
        const heroHeight = hero.clientHeight;
        const wide = heroWidth > 800;
        rest = wide ? { x: 34, y: 0, z: -9 } : { x: 30, y: 0, z: -6 };
        tilt = { ...rest };
        const matrix = tiltMatrix(tilt);
        canvas.style.transform = matrix.toString();
        // Place the emblem where it should land on screen after the tilt.
        const center = toCanvas(matrix, heroWidth * (wide ? 0.74 : 0.6), heroHeight * (wide ? 0.44 : 0.3));
        const layout = {
            cx: center.x,
            cy: center.y,
            radius: wide ? Math.min(heroWidth, heroHeight) * 0.6 : heroWidth * 0.75,
            pitch: Math.max(6, Math.min(10, heroWidth / 150)),
            reveal: Math.hypot(heroWidth, heroHeight),
        };
        // Most of the floor is blurred or far away, so 1.5x is enough.
        ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = base.width = Math.round(width * ratio);
        canvas.height = base.height = Math.round(height * ratio);
        sheenContext.canvas.width = glowContext.canvas.width = width;
        sheenContext.canvas.height = glowContext.canvas.height = height;
        baseContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        baseContext.fillStyle = INK;
        baseContext.fillRect(0, 0, width, height);
        scene = build(width, height, layout);
        scene.reach = Math.max(heroWidth, heroHeight);
        scene.band = layout.radius * 0.42;
        light.x = scene.cx;
        light.y = scene.cy;
        return true;
    };

    // Tiles are drawn once into the base canvas; frames only composite light on top.
    const layTiles = (until) => {
        const { tiles } = scene;
        while (scene.laid < tiles.length && tiles[scene.laid].at <= until) {
            const tile = tiles[scene.laid];
            const { depth, length, color } = tile;
            const cos = Math.cos(tile.angle);
            const sin = Math.sin(tile.angle);
            // Offsets are in screen space so every tile is lit from the top left.
            const place = (target, scale, dx = 0, dy = 0) =>
                target.setTransform(cos * scale, sin * scale, -sin * scale, cos * scale, (tile.x + dx) * scale, (tile.y + dy) * scale);
            const fill = (target, style, inset = 0) => {
                target.fillStyle = style;
                target.fillRect(-depth / 2 + inset, -length / 2 + inset, depth - inset * 2, length - inset * 2);
            };

            // Bevel and shadow grow with the tile, so the large band tiles stand proud.
            const bevel = Math.max(0.5, Math.min(depth, length) * 0.06);

            place(baseContext, ratio, bevel * 2.4, bevel * 3.2);
            fill(baseContext, 'rgb(0 0 0 / 0.65)', -0.4);
            place(baseContext, ratio, bevel, bevel);
            fill(baseContext, rgb(color, 0.5));
            place(baseContext, ratio, -bevel, -bevel);
            fill(baseContext, rgb(color, 1.3, 24));
            place(baseContext, ratio);
            fill(baseContext, rgb(color), bevel * 1.2);

            place(sheenContext, 1);
            fill(sheenContext, tile.warm ? `rgb(255 206 130 / ${tile.gloss})` : `rgb(255 246 230 / ${tile.gloss})`, bevel * 1.2);
            scene.laid += 1;
        }
        if (scene.laid === tiles.length && !scene.blurred) {
            soften(until);
        }
    };

    // Tilt-shift: a blurred copy of the finished floor, masked so only a band through the emblem stays sharp.
    const soften = (time) => {
        const { cy, band } = scene;
        const blurred = layer();
        blurred.canvas.width = base.width;
        blurred.canvas.height = base.height;
        blurred.filter = `blur(${7 * ratio}px)`;
        blurred.drawImage(base, 0, 0);
        blurred.filter = 'none';
        blurred.globalCompositeOperation = 'destination-in';
        const mask = blurred.createLinearGradient(0, 0, 0, base.height);
        const stop = (y, alpha) => mask.addColorStop(Math.min(1, Math.max(0, (y * ratio) / base.height)), `rgb(0 0 0 / ${alpha})`);
        stop(cy - band * 2, 1);
        stop(cy - band * 0.9, 0);
        stop(cy + band * 1.1, 0);
        stop(cy + band * 2.2, 1);
        blurred.fillStyle = mask;
        blurred.fillRect(0, 0, base.width, base.height);
        scene.blurred = blurred.canvas;
        scene.blurredAt = Number.isFinite(time) ? time : -Infinity;
    };

    const render = (time, elapsed) => {
        const { width, height, cx, cy, flecks, reach } = scene;

        // The pointer steers the tilt a little, and the light follows it across the floor.
        const lean = pointer.active
            ? { x: rest.x - (pointer.y / hero.clientHeight - 0.5) * 8, y: rest.y + (pointer.x / hero.clientWidth - 0.5) * 10 }
            : rest;
        tilt.x += (lean.x - tilt.x) * 0.05;
        tilt.y += (lean.y - tilt.y) * 0.05;
        const matrix = tiltMatrix(tilt);
        canvas.style.transform = matrix.toString();

        const target = pointer.active
            ? toCanvas(matrix, pointer.x, pointer.y)
            : { x: cx + Math.sin(time * 0.00013) * reach * 0.14, y: cy + Math.cos(time * 0.0001) * reach * 0.1 };
        light.x += (target.x - light.x) * 0.04;
        light.y += (target.y - light.y) * 0.04;

        const radial = (target, radius, stops) => {
            const gradient = target.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
            stops.forEach(([at, color]) => gradient.addColorStop(at, color));
            target.fillStyle = gradient;
            target.fillRect(0, 0, width, height);
        };

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.drawImage(base, 0, 0, width, height);
        if (scene.blurred) {
            context.globalAlpha = Math.min(1, (elapsed - scene.blurredAt) / 900);
            context.drawImage(scene.blurred, 0, 0, width, height);
            context.globalAlpha = 1;
        }

        // Glossy tiles near the light flare up.
        glowContext.globalCompositeOperation = 'copy';
        glowContext.drawImage(sheenContext.canvas, 0, 0);
        glowContext.globalCompositeOperation = 'destination-in';
        radial(glowContext, reach * 0.42, [[0, 'rgb(0 0 0 / 1)'], [0.45, 'rgb(0 0 0 / 0.35)'], [1, 'rgb(0 0 0 / 0)']]);
        context.globalCompositeOperation = 'lighter';
        context.drawImage(glowContext.canvas, 0, 0, width, height);

        context.globalCompositeOperation = 'overlay';
        radial(context, reach * 0.5, [[0, 'rgb(255 196 140 / 0.45)'], [1, 'rgb(255 196 140 / 0)']]);

        context.globalCompositeOperation = 'source-over';
        radial(context, reach * 0.85, [[0, 'rgb(4 10 10 / 0)'], [0.35, 'rgb(4 10 10 / 0.15)'], [1, 'rgb(4 10 10 / 0.9)']]);

        // Out-of-focus flecks spread into soft bokeh discs.
        flecks.forEach((fleck) => {
            const lit = Math.max(0, 1 - Math.hypot(fleck.x - light.x, fleck.y - light.y) / (reach * 0.6));
            const glint = Math.max(0, Math.sin(time * fleck.speed + fleck.phase)) ** 8;
            const blur = Math.min(1, Math.max(0, Math.abs(fleck.y - scene.cy) / scene.band - 1));
            context.globalAlpha = (lit * (0.35 + glint * 0.65)) / (1 + blur * 2.5);
            context.fillStyle = glint > 0.4 ? '#fff1b8' : '#e2bd4c';
            context.beginPath();
            context.arc(fleck.x, fleck.y, fleck.size * (0.6 + blur * 4), 0, Math.PI * 2);
            context.fill();
        });
        context.globalAlpha = 1;
    };

    if (reduceMotion) {
        const still = () => {
            if (setup()) {
                layTiles(Infinity);
                render(0, 0);
            }
        };
        still();
        window.addEventListener('resize', still);
        return;
    }

    let start;
    let frameId;
    const frame = (time) => {
        start ??= time;
        layTiles(time - start);
        render(time, time - start);
        frameId = requestAnimationFrame(frame);
    };

    setup();
    new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(frameId);
        if (entry.isIntersecting) {
            frameId = requestAnimationFrame(frame);
        }
    }).observe(canvas);

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (setup()) {
                layTiles(Infinity);
            }
        }, 150);
    });

    if (window.matchMedia('(pointer: fine)').matches) {
        hero.addEventListener('pointermove', (event) => {
            const rect = hero.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;
        });
        hero.addEventListener('pointerleave', () => {
            pointer.active = false;
        });
    }
})();
