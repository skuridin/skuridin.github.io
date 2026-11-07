const COLORS = {
    paper: [236, 229, 214],
    vermilion: [214, 78, 28],
    petrol: [0, 58, 88],
    petrolMid: [10, 88, 118],
    petrolLight: [30, 122, 152],
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
// White tesserae are marble, coloured ones are matte smalti, gold is leaf under glass.
const KIND = { paper: 'stone', gold: 'gold' };
// Share of tesserae swapped for small gold chips, which flash in the light and bloom into bokeh.
const GOLD_CHIPS = 0.015;
const ASSEMBLE_MS = 2400;
const DEGREE = Math.PI / 180;

// Seeded so the pattern stays the same between visits and resizes.
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const tint = (name, random) => {
    // Vermilion tiles get a wider spread, from deep rust to bright orange.
    const [base, spread] = name === 'vermilion' ? [0.55, 0.7] : [0.7, 0.45];
    let light = base + random() * spread;
    let cool = [1, 1, 1];
    // Marble whites run from warm white through grey to blue-grey.
    if (name === 'paper') {
        light *= random() < 0.25 ? 0.7 : 1;
        cool = random() < 0.3 ? [0.86, 0.91, 0.97] : cool;
    }
    const hue = name === 'paper' ? 4 : 18;
    return COLORS[name].map((value, channel) =>
        Math.min(255, Math.max(0, value * light * cool[channel] + (random() - 0.5) * hue)));
};

// Lays the emblem around the origin, ring by ring, out to `reach`. Units are CSS pixels on the floor.
export const build = ({ radius, pitch, reveal, reach, visible }) => {
    const random = seeded(11);
    const grout = pitch * 0.45;
    const tiles = [];

    const lay = (r, count, depth, colorAt) => {
        const offset = random() * Math.PI * 2;
        const arc = (Math.PI * 2 * r) / count;
        for (let index = 0; index < count; index += 1) {
            const angle = offset + (index * Math.PI * 2) / count + ((random() - 0.5) * arc * 0.16) / r;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const zoneName = visible(x, z) && colorAt(angle, index);
            if (!zoneName) {
                continue;
            }
            const chip = zoneName !== 'gold' && depth < pitch * 2 && random() < GOLD_CHIPS;
            const name = chip ? 'gold' : zoneName;
            const shrink = chip ? 0.6 : 1;
            const size = depth * (0.8 + random() * 0.14) * shrink;
            tiles.push({
                x,
                z,
                angle: angle + (random() - 0.5) * 0.14,
                depth: size,
                length: arc * (0.8 + random() * 0.14) * shrink,
                height: Math.min(size, arc) * (0.38 + random() * 0.2) * (chip ? 1.4 : 1),
                // Hand-set tesserae are never quite level, so each one catches the light differently.
                tipX: (random() - 0.5) * 7 * DEGREE,
                tipZ: (random() - 0.5) * 7 * DEGREE,
                color: tint(name, random),
                kind: KIND[name] || 'smalti',
                at: (r / reveal) * ASSEMBLE_MS + random() * 300,
                gloss: random(),
            });
        }
    };

    const rayAt = (r) => (angle) => {
        const turn = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
        const position = turn * RAYS.length;
        const fromEdge = Math.min(position % 1, 1 - (position % 1)) * ((Math.PI * 2 * r) / RAYS.length);
        return fromEdge < grout ? null : RAYS[Math.floor(position)];
    };

    // The band keeps its paper and gold blocks, now set from tesserae of the same size as the rest.
    const bandMiddle = ZONES.find(([, name]) => name === 'band')[0] * radius;
    const blocks = Math.round((Math.PI * 2 * bandMiddle) / (radius * 0.15) / BAND.length) * BAND.length;
    const bandAt = (angle) => {
        const turn = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
        return BAND[Math.floor(turn * blocks) % BAND.length];
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
        const rows = Math.max(1, Math.round(span / pitch));
        const step = span / rows;
        for (let row = 0; row < rows; row += 1) {
            const r = start + step * (row + 0.5);
            const count = Math.max(3, Math.round((Math.PI * 2 * r) / step));
            lay(r, count, step, { rays: rayAt(r), band: bandAt }[name] || (() => name));
        }
    });
    return tiles;
};
