const SHAPES = ['cube', 'smallcube', 'flatbox', 'tallbox'];

const PALETTES = [
    // Cyber / Neon
    [[0.0, 1.0, 0.8], [1.0, 0.2, 0.6], [0.2, 0.6, 1.0], [1.0, 0.8, 0.0]],
    // Warm
    [[1.0, 0.3, 0.1], [1.0, 0.6, 0.0], [0.9, 0.9, 0.2], [0.8, 0.2, 0.0]],
    // Cool
    [[0.1, 0.5, 1.0], [0.0, 0.8, 1.0], [0.3, 0.2, 0.9], [0.0, 1.0, 0.6]],
];

function createSeededRandom(seed) {
    let state = (Math.floor(seed) ^ 0x9E3779B9) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function resolveRandom(seed) {
    return Number.isFinite(seed) ? createSeededRandom(seed) : Math.random;
}

/**
 * Generate array objek 3D secara prosedural.
 *
 * @param {number} count      - Jumlah objek yang akan dibuat
 * @param {number} worldSize  - Setengah ukuran dunia (spread area)
 * @param {number} paletteIdx - Index palet warna (0-2)
 * @returns {Array} Array of {pos, color, scale, shape, id}
 */
export function generateObjects(count, worldSize = 500, paletteIdx = 0, seed = undefined) {
    const palette = PALETTES[paletteIdx % PALETTES.length];
    const random = resolveRandom(seed);
    const objects  = [];

    for (let i = 0; i < count; i++) {
        // Pilih warna dari palet + sedikit variasi acak
        const base  = palette[i % palette.length];
        const color = [
            Math.min(1, base[0] + (random() - 0.5) * 0.3),
            Math.min(1, base[1] + (random() - 0.5) * 0.3),
            Math.min(1, base[2] + (random() - 0.5) * 0.3),
        ];

        // Ukuran bervariasi (skala dasar; LOD akan memodifikasi lebih lanjut)
        const baseScale = 0.5 + random() * 2.0;

        objects.push({
            id:    `generated-${i + 1}`,
            name:  `Object_${i + 1}`,
            pos:   [
                (random() - 0.5) * worldSize * 2,
                (random() - 0.5) * worldSize * 2,
                (random() - 0.5) * worldSize * 2,
            ],
            color: color,
            scale: baseScale,
            shape: SHAPES[Math.floor(random() * SHAPES.length)],
        });
    }
    return objects;
}

/**
 * Generate posisi acak yang tersebar lebih merata (cluster-based)
 * Digunakan untuk skenario pengujian "scene padat"
 */
export function generateClustered(count, worldSize = 500, clusterCount = 10, seed = undefined) {
    const random = resolveRandom(seed);
    const objects = [];
    const centers = [];
    // Buat cluster centers
    for (let c = 0; c < clusterCount; c++) {
        centers.push([
            (random() - 0.5) * worldSize * 2,
            (random() - 0.5) * worldSize * 2,
            (random() - 0.5) * worldSize * 2,
        ]);
    }

    for (let i = 0; i < count; i++) {
        const center = centers[i % clusterCount];
        const spread = worldSize * 0.2;
        const color = [random(), random(), random()];
        objects.push({
            id:    `generated-${i + 1}`,
            name:  `Object_${i + 1}`,
            pos:   [
                center[0] + (random() - 0.5) * spread,
                center[1] + (random() - 0.5) * spread,
                center[2] + (random() - 0.5) * spread,
            ],
            color,
            scale: 0.5 + random() * 1.5,
            shape: 'cube',
        });
    }
    return objects;
}
