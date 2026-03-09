const SHAPES = ['cube', 'smallcube', 'flatbox', 'tallbox'];

const PALETTES = [
    // Cyber / Neon
    [[0.0, 1.0, 0.8], [1.0, 0.2, 0.6], [0.2, 0.6, 1.0], [1.0, 0.8, 0.0]],
    // Warm
    [[1.0, 0.3, 0.1], [1.0, 0.6, 0.0], [0.9, 0.9, 0.2], [0.8, 0.2, 0.0]],
    // Cool
    [[0.1, 0.5, 1.0], [0.0, 0.8, 1.0], [0.3, 0.2, 0.9], [0.0, 1.0, 0.6]],
];

/**
 * Generate array objek 3D secara prosedural.
 *
 * @param {number} count      - Jumlah objek yang akan dibuat
 * @param {number} worldSize  - Setengah ukuran dunia (spread area)
 * @param {number} paletteIdx - Index palet warna (0-2)
 * @returns {Array} Array of {pos, color, scale, shape, id}
 */
export function generateObjects(count, worldSize = 500, paletteIdx = 0) {
    const palette = PALETTES[paletteIdx % PALETTES.length];
    const objects  = [];

    for (let i = 0; i < count; i++) {
        // Pilih warna dari palet + sedikit variasi acak
        const base  = palette[i % palette.length];
        const color = [
            Math.min(1, base[0] + (Math.random() - 0.5) * 0.3),
            Math.min(1, base[1] + (Math.random() - 0.5) * 0.3),
            Math.min(1, base[2] + (Math.random() - 0.5) * 0.3),
        ];

        // Ukuran bervariasi (skala dasar; LOD akan memodifikasi lebih lanjut)
        const baseScale = 0.5 + Math.random() * 2.0;

        objects.push({
            id:    i,
            pos:   [
                (Math.random() - 0.5) * worldSize * 2,
                (Math.random() - 0.5) * worldSize * 2,
                (Math.random() - 0.5) * worldSize * 2,
            ],
            color: color,
            scale: baseScale,
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        });
    }
    return objects;
}

/**
 * Generate posisi acak yang tersebar lebih merata (cluster-based)
 * Digunakan untuk skenario pengujian "scene padat"
 */
export function generateClustered(count, worldSize = 500, clusterCount = 10) {
    const objects = [];
    const centers = [];
    // Buat cluster centers
    for (let c = 0; c < clusterCount; c++) {
        centers.push([
            (Math.random() - 0.5) * worldSize * 2,
            (Math.random() - 0.5) * worldSize * 2,
            (Math.random() - 0.5) * worldSize * 2,
        ]);
    }

    for (let i = 0; i < count; i++) {
        const center = centers[i % clusterCount];
        const spread = worldSize * 0.2;
        const color = [Math.random(), Math.random(), Math.random()];
        objects.push({
            id:    i,
            pos:   [
                center[0] + (Math.random() - 0.5) * spread,
                center[1] + (Math.random() - 0.5) * spread,
                center[2] + (Math.random() - 0.5) * spread,
            ],
            color,
            scale: 0.5 + Math.random() * 1.5,
            shape: 'cube',
        });
    }
    return objects;
}
