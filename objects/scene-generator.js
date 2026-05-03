const COMPLEXITY_PRESETS = {
    low: {
        key: 'low',
        label: 'Low Complexity',
        objectCount: 320,
        worldSize: 220,
        clusterCount: 5,
        laneCount: 3,
        floorCount: 2,
        verticalRange: 30,
        baseScaleRange: [0.8, 2.2],
    },
    medium: {
        key: 'medium',
        label: 'Medium Complexity',
        objectCount: 1200,
        worldSize: 360,
        clusterCount: 8,
        laneCount: 5,
        floorCount: 4,
        verticalRange: 80,
        baseScaleRange: [0.65, 2.8],
    },
    high: {
        key: 'high',
        label: 'High Complexity',
        objectCount: 4200,
        worldSize: 520,
        clusterCount: 12,
        laneCount: 8,
        floorCount: 8,
        verticalRange: 150,
        baseScaleRange: [0.4, 3.4],
    },
};

const PALETTES = [
    [[0.0, 1.0, 0.8], [1.0, 0.2, 0.6], [0.2, 0.6, 1.0], [1.0, 0.8, 0.0]],
    [[1.0, 0.3, 0.1], [1.0, 0.6, 0.0], [0.9, 0.9, 0.2], [0.8, 0.2, 0.0]],
    [[0.1, 0.5, 1.0], [0.0, 0.8, 1.0], [0.3, 0.2, 0.9], [0.0, 1.0, 0.6]],
];

const GEOMETRY_BUCKETS = ['cube', 'sphere', 'cylinder', 'cone', 'prism', 'pyramid'];

const CATEGORY_LIBRARY = [
    { id: 'terrain', label: 'Terrain', geometry: 'plane', weight: 0.05, scale: [18, 1, 18] },
    { id: 'building', label: 'Buildings', geometry: 'prism', weight: 0.28, scale: [1.8, 5.8, 1.8] },
    { id: 'column', label: 'Columns', geometry: 'cylinder', weight: 0.12, scale: [0.8, 4.8, 0.8] },
    { id: 'cover', label: 'Occluders', geometry: 'cube', weight: 0.2, scale: [2.8, 2.2, 1.6] },
    { id: 'deco', label: 'Decor', geometry: 'sphere', weight: 0.17, scale: [1.1, 1.1, 1.1] },
    { id: 'tower', label: 'Towers', geometry: 'cone', weight: 0.08, scale: [1.2, 3.4, 1.2] },
    { id: 'roof', label: 'Roofs', geometry: 'pyramid', weight: 0.1, scale: [1.8, 1.6, 1.8] },
];

const VOXEL_GROUP_LABELS = {
    terrain: 'Terrain',
    subsoil: 'Subsoil',
    trunk: 'Tree Trunk',
    leaves: 'Leaves',
};

const DUNGEON_GROUP_LABELS = {
    floor: 'Floor',
    wall: 'Wall',
    pillar: 'Pillar',
    prop: 'Prop',
};

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

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function tintColor(base, variance = 0.18, random = Math.random) {
    return [
        clamp01(base[0] + (random() - 0.5) * variance),
        clamp01(base[1] + (random() - 0.5) * variance),
        clamp01(base[2] + (random() - 0.5) * variance),
    ];
}

function chooseCategory(random = Math.random) {
    const total = CATEGORY_LIBRARY.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    for (const item of CATEGORY_LIBRARY) {
        cursor -= item.weight;
        if (cursor <= 0) return item;
    }
    return CATEGORY_LIBRARY[CATEGORY_LIBRARY.length - 1];
}

function createBounds(position, scaleVec) {
    const halfSize = scaleVec.map(value => Math.max(Math.abs(value), 0.05));
    const radius = Math.max(Math.hypot(halfSize[0], halfSize[1], halfSize[2]), 0.1);
    return {
        center: [...position],
        halfSize,
        radius,
        min: [
            position[0] - halfSize[0],
            position[1] - halfSize[1],
            position[2] - halfSize[2],
        ],
        max: [
            position[0] + halfSize[0],
            position[1] + halfSize[1],
            position[2] + halfSize[2],
        ],
    };
}

function hash2D(x, z, seed = 0) {
    const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
    return value - Math.floor(value);
}

function layeredNoise(x, z, seed = 0) {
    const n1 = hash2D(x * 0.07, z * 0.07, seed);
    const n2 = hash2D(x * 0.16, z * 0.16, seed + 19);
    const n3 = hash2D(x * 0.33, z * 0.33, seed + 61);
    return n1 * 0.58 + n2 * 0.29 + n3 * 0.13;
}

function sampleVoxelHeight(x, z, seed = 0) {
    const terrain = layeredNoise(x, z, seed);
    const ridge = Math.abs(layeredNoise(x + 100, z - 100, seed + 211) - 0.5) * 2;
    // Diperbesar: range ketinggian dari ~9 jadi ~22 unit
    // Ini penting agar dari sudut samping ada banyak objek yang ter-occlude
    // oleh terrain/pohon yang lebih tinggi di depannya
    return Math.round(terrain * 22 - ridge * 4) - 3;
}

function buildVoxelPalette(paletteIdx = 0) {
    const accentSet = PALETTES[((paletteIdx % PALETTES.length) + PALETTES.length) % PALETTES.length];
    const accent = accentSet[paletteIdx % accentSet.length];
    return {
        grass: [
            clamp01(0.2 + accent[0] * 0.08),
            clamp01(0.56 + accent[1] * 0.2),
            clamp01(0.2 + accent[2] * 0.08),
        ],
        dirt: [
            clamp01(0.43 + accent[0] * 0.04),
            clamp01(0.29 + accent[1] * 0.03),
            clamp01(0.16 + accent[2] * 0.03),
        ],
        stone: [0.5, 0.54, 0.6],
        trunk: [0.48, 0.34, 0.2],
        leaves: [
            clamp01(0.16 + accent[0] * 0.1),
            clamp01(0.58 + accent[1] * 0.18),
            clamp01(0.19 + accent[2] * 0.08),
        ],
    };
}

function makeObject(id, category, preset, palette, clusterCenter, laneIndex, random = Math.random) {
    const spread = preset.worldSize * (category.id === 'terrain' ? 0.9 : 0.12 + random() * 0.14);
    const scaleFactor = preset.baseScaleRange[0] + random() * (preset.baseScaleRange[1] - preset.baseScaleRange[0]);
    const baseScale = category.scale || [1, 1, 1];
    const scaleVec = [
        Math.max(0.3, baseScale[0] * scaleFactor * (0.85 + random() * 0.3)),
        Math.max(0.3, baseScale[1] * scaleFactor * (0.85 + random() * 0.35)),
        Math.max(0.3, baseScale[2] * scaleFactor * (0.85 + random() * 0.3)),
    ];

    const laneOffset = (laneIndex - (preset.laneCount - 1) * 0.5) * (preset.worldSize * 0.14);
    const position = category.id === 'terrain'
        ? [
            (random() - 0.5) * preset.worldSize * 1.6,
            -8 - random() * 12,
            (random() - 0.5) * preset.worldSize * 1.6,
        ]
        : [
            clusterCenter[0] + (random() - 0.5) * spread,
            Math.round((random() - 0.5) * preset.floorCount) * (preset.verticalRange / Math.max(1, preset.floorCount)),
            clusterCenter[2] + laneOffset + (random() - 0.5) * spread,
        ];

    const color = tintColor(palette[id % palette.length], category.id === 'terrain' ? 0.08 : 0.18, random);
    const geometry = category.geometry === 'plane'
        ? 'plane'
        : category.geometry || GEOMETRY_BUCKETS[id % GEOMETRY_BUCKETS.length];

    return {
        id: `generated-${id + 1}`,
        name: `${category.label}_${id + 1}`,
        pos: position,
        color,
        scale: scaleFactor,
        scaleVec,
        rotationY: random() * Math.PI * 2,
        geometry,
        category: category.label,
        groupId: category.id,
        instancedKey: `${category.id}:${geometry}`,
        lodWeight: category.id === 'terrain' ? 0.15 : category.id === 'building' ? 1.35 : 1.0,
        polygonWeight: geometry === 'sphere' ? 3 : geometry === 'cylinder' || geometry === 'cone' ? 2 : 1,
        isOccluder: category.id === 'building' || category.id === 'cover' || category.id === 'column',
        bounds: createBounds(position, scaleVec),
    };
}

export function getComplexityPresets() {
    return COMPLEXITY_PRESETS;
}

export function generateComplexityScene(level = 'medium', paletteIdx = 0, options = {}) {
    const preset = COMPLEXITY_PRESETS[level] || COMPLEXITY_PRESETS.medium;
    const seed = Number.isFinite(options.seed) ? options.seed : Math.random() * 10000;
    const random = resolveRandom(seed);
    const palette = PALETTES[paletteIdx % PALETTES.length];
    const objects = [];
    const groups = {};
    const clusterCenters = Array.from({ length: preset.clusterCount }, (_, index) => {
        const radius = preset.worldSize * (0.15 + (index / Math.max(1, preset.clusterCount - 1)) * 0.55);
        const angle = (index / preset.clusterCount) * Math.PI * 2;
        return [
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius,
        ];
    });

    for (let index = 0; index < preset.objectCount; index++) {
        const category = chooseCategory(random);
        const clusterCenter = clusterCenters[index % clusterCenters.length];
        const laneIndex = index % preset.laneCount;
        const object = makeObject(index, category, preset, palette, clusterCenter, laneIndex, random);
        objects.push(object);
        groups[category.label] = (groups[category.label] || 0) + 1;
    }

    return {
        label: preset.label,
        level: preset.key,
        objects,
        groups,
        config: {
            objectCount: preset.objectCount,
            worldSize: preset.worldSize,
            clusterCount: preset.clusterCount,
            estimatedVertexLoad: objects.reduce((sum, object) => sum + object.polygonWeight * 36, 0),
            seed,
        },
    };
}

export function generateVoxelWorld(options = {}) {
    const requestedTarget = Number(options.targetCount);
    const targetCount = Math.max(
        2500,
        Math.min(90000, Number.isFinite(requestedTarget) ? Math.floor(requestedTarget) : 16000)
    );
    const palette = buildVoxelPalette(options.paletteIdx || 0);
    const seed = Number.isFinite(options.seed) ? options.seed : Math.random() * 10000;

    const terrainBudget = Math.max(2000, Math.floor(targetCount * 0.76));
    // blockHalf diperbesar 1.8 → 2.4 agar world lebih luas → LOD bisa aktif
    // pada threshold default (nearThreshold=150, farThreshold=600)
    const blockHalf = 2.4;
    const cellSize = blockHalf * 2;
    const roughSideLength = Math.floor(Math.sqrt(terrainBudget));
    const sideLength = Math.max(80, Math.min(320, roughSideLength | 1));
    const half = Math.floor(sideLength / 2);

    const objects = [];
    const groups = {};
    const occupied = new Set();
    const heightMap = new Map();
    const columns = [];
    const surfaceCells = new Set();
    let id = 1;

    const markGroup = groupId => {
        const label = VOXEL_GROUP_LABELS[groupId] || 'Voxel';
        groups[label] = (groups[label] || 0) + 1;
        return label;
    };

    const pushBlock = (x, y, z, groupId, color, extra = {}) => {
        if (objects.length >= targetCount) return false;
        const key = `${x}|${y}|${z}`;
        if (occupied.has(key)) return false;
        occupied.add(key);

        const label = markGroup(groupId);
        const pos = [x * cellSize, y * cellSize, z * cellSize];
        const scaleVec = [blockHalf, blockHalf, blockHalf];
        objects.push({
            id: `generated-${id}`,
            name: `${label.replace(/\s+/g, '')}_${id}`,
            pos,
            color,
            scale: 1,
            scaleVec,
            rotationY: 0,
            geometry: 'cube',
            category: label,
            groupId,
            instancedKey: `voxel:${groupId}:cube`,
            lodWeight: extra.lodWeight ?? (groupId === 'leaves' ? 0.86 : 1.18),
            polygonWeight: 1,
            isOccluder: extra.isOccluder ?? groupId !== 'leaves',
            lockGeometry: true,
            bounds: createBounds(pos, scaleVec),
        });
        id++;
        return true;
    };

    for (let z = -half; z <= half; z++) {
        for (let x = -half; x <= half; x++) {
            const h = sampleVoxelHeight(x, z, seed);
            heightMap.set(`${x}|${z}`, h);
            columns.push({ x, z, h });
        }
    }

    let terrainCount = 0;
    for (const column of columns) {
        if (terrainCount >= terrainBudget) break;
        const { x, z, h } = column;

        const biome = hash2D(x * 0.15, z * 0.15, seed + 97);
        const topColor = h > 4 ? palette.stone : biome < 0.2 ? palette.dirt : palette.grass;
        if (pushBlock(x, h, z, 'terrain', topColor, { lodWeight: 1.08, isOccluder: true })) {
            terrainCount++;
            surfaceCells.add(`${x}|${z}`);
        }

        const fillerDepth = 1 + (h > 3 ? 1 : 0) + (hash2D(x * 0.37, z * 0.37, seed + 41) > 0.8 ? 1 : 0);
        for (let d = 1; d <= fillerDepth && terrainCount < terrainBudget; d++) {
            const subColor = d === fillerDepth && h > 2 ? palette.stone : palette.dirt;
            if (pushBlock(x, h - d, z, 'subsoil', subColor, { lodWeight: 1.24, isOccluder: true })) {
                terrainCount++;
            }
        }
    }

    for (const column of columns) {
        if (objects.length >= targetCount) break;
        const { x, z, h } = column;
        if (!surfaceCells.has(`${x}|${z}`)) continue;

        const north = heightMap.get(`${x}|${z - 1}`) ?? h;
        const south = heightMap.get(`${x}|${z + 1}`) ?? h;
        const east = heightMap.get(`${x + 1}|${z}`) ?? h;
        const west = heightMap.get(`${x - 1}|${z}`) ?? h;
        const slope = Math.max(Math.abs(h - north), Math.abs(h - south), Math.abs(h - east), Math.abs(h - west));
        if (slope > 1) continue;

        const chance = hash2D(x * 0.29, z * 0.29, seed + 257);
        if (chance < 0.88) continue;

        const trunkHeight = 4 + Math.floor(hash2D(x * 0.41, z * 0.41, seed + 311) * 4);
        for (let y = 1; y <= trunkHeight && objects.length < targetCount; y++) {
            pushBlock(x, h + y, z, 'trunk', palette.trunk, { lodWeight: 1.28, isOccluder: true });
        }

        const canopyBase = h + trunkHeight - 1;
        for (let oy = 0; oy <= 3 && objects.length < targetCount; oy++) {
            for (let ox = -2; ox <= 2 && objects.length < targetCount; ox++) {
                for (let oz = -2; oz <= 2 && objects.length < targetCount; oz++) {
                    const dist = Math.abs(ox) + Math.abs(oz) + Math.abs(oy - 1);
                    if (dist > 3) continue;
                    if (ox === 0 && oz === 0 && oy <= 1) continue;
                    const trim = hash2D((x + ox) * 0.51, (z + oz) * 0.51, seed + 401 + oy * 19);
                    if (dist === 3 && trim < 0.35) continue;
                    pushBlock(x + ox, canopyBase + oy, z + oz, 'leaves', palette.leaves, { lodWeight: 0.84, isOccluder: false });
                }
            }
        }
    }

    for (const column of columns) {
        if (objects.length >= targetCount) break;
        const { x, z, h } = column;
        if (!surfaceCells.has(`${x}|${z}`)) continue;
        if (hash2D(x * 0.77, z * 0.77, seed + 511) < 0.82) continue;
        pushBlock(x, h + 1, z, 'leaves', palette.leaves, { lodWeight: 0.8, isOccluder: false });
    }

    return {
        label: 'Voxel Forest XL',
        level: 'voxel',
        objects,
        groups,
        config: {
            objectCount: objects.length,
            worldSize: half * cellSize,
            clusterCount: 0,
            estimatedVertexLoad: objects.length * 36,
            seed,
        },
    };
}

export function generateDungeonWorld(options = {}) {
    const requestedTarget = Number(options.targetCount);
    const targetCount = Math.max(
        2500,
        Math.min(90000, Number.isFinite(requestedTarget) ? Math.floor(requestedTarget) : 14000)
    );
    const seed = Number.isFinite(options.seed) ? options.seed : Math.random() * 10000;
    const random = resolveRandom(seed);
    const paletteIdx = Number.isFinite(options.paletteIdx) ? options.paletteIdx : 0;
    const palette = PALETTES[((paletteIdx % PALETTES.length) + PALETTES.length) % PALETTES.length];
    const blockHalf = 1.6;
    const cellSize = blockHalf * 2;

    const baseFloorColor = tintColor(palette[2], 0.08, random);
    const baseWallColor = tintColor(palette[1], 0.06, random);
    const pillarColor = tintColor(palette[0], 0.08, random);
    const propColor = tintColor(palette[3], 0.1, random);

    const sideLength = Math.max(61, Math.min(221, (Math.floor(Math.sqrt(targetCount * 0.8)) | 1)));
    const half = Math.floor(sideLength / 2);
    const walkable = new Set();
    const objects = [];
    const groups = {};
    const occupied = new Set();
    let id = 1;

    const markGroup = groupId => {
        const label = DUNGEON_GROUP_LABELS[groupId] || 'Dungeon';
        groups[label] = (groups[label] || 0) + 1;
        return label;
    };

    const pushBlock = (x, y, z, groupId, color, scaleVec = [blockHalf, blockHalf, blockHalf], extra = {}) => {
        if (objects.length >= targetCount) return false;
        const key = `${x}|${y}|${z}`;
        if (occupied.has(key)) return false;
        occupied.add(key);
        const label = markGroup(groupId);
        const pos = [x * cellSize, y * cellSize, z * cellSize];
        objects.push({
            id: `generated-${id}`,
            name: `${label.replace(/\s+/g, '')}_${id}`,
            pos,
            color,
            scale: 1,
            scaleVec,
            rotationY: 0,
            geometry: 'cube',
            category: label,
            groupId,
            instancedKey: `dungeon:${groupId}:cube`,
            lodWeight: extra.lodWeight ?? 1.1,
            polygonWeight: 1,
            isOccluder: extra.isOccluder ?? groupId !== 'prop',
            lockGeometry: true,
            bounds: createBounds(pos, scaleVec),
        });
        id++;
        return true;
    };

    const roomCount = Math.max(6, Math.floor(sideLength / 14));
    for (let i = 0; i < roomCount; i++) {
        const cx = Math.floor((random() - 0.5) * sideLength * 0.85);
        const cz = Math.floor((random() - 0.5) * sideLength * 0.85);
        const rw = 3 + Math.floor(random() * 6);
        const rz = 3 + Math.floor(random() * 6);
        for (let z = cz - rz; z <= cz + rz; z++) {
            for (let x = cx - rw; x <= cx + rw; x++) {
                if (x < -half || x > half || z < -half || z > half) continue;
                walkable.add(`${x}|${z}`);
            }
        }
    }

    for (let z = -half; z <= half; z++) {
        for (let x = -half; x <= half; x++) {
            const corridor = Math.abs(x) <= 1 || Math.abs(z) <= 1;
            const noiseOpen = hash2D(x * 0.23, z * 0.23, seed + 19) > 0.46;
            if (corridor || noiseOpen) walkable.add(`${x}|${z}`);
        }
    }

    const neighbors = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
    ];

    for (const cell of walkable) {
        const [x, z] = cell.split('|').map(Number);
        pushBlock(
            x,
            -1,
            z,
            'floor',
            baseFloorColor,
            [blockHalf, blockHalf * 0.35, blockHalf],
            { lodWeight: 0.95, isOccluder: true }
        );
    }

    for (const cell of walkable) {
        if (objects.length >= targetCount) break;
        const [x, z] = cell.split('|').map(Number);
        for (const [dx, dz] of neighbors) {
            const nx = x + dx;
            const nz = z + dz;
            if (walkable.has(`${nx}|${nz}`)) continue;
            const wallHeight = 2 + Math.floor(hash2D(nx * 0.37, nz * 0.37, seed + 71) * 3);
            for (let h = 0; h < wallHeight && objects.length < targetCount; h++) {
                pushBlock(nx, h, nz, 'wall', baseWallColor, [blockHalf, blockHalf, blockHalf], { lodWeight: 1.2, isOccluder: true });
            }
        }
    }

    for (const cell of walkable) {
        if (objects.length >= targetCount) break;
        const [x, z] = cell.split('|').map(Number);
        if (hash2D(x * 0.41, z * 0.41, seed + 131) > 0.91) {
            const pillarHeight = 2 + Math.floor(hash2D(x * 0.53, z * 0.53, seed + 137) * 3);
            for (let h = 0; h < pillarHeight && objects.length < targetCount; h++) {
                pushBlock(x, h, z, 'pillar', pillarColor, [blockHalf * 0.55, blockHalf, blockHalf * 0.55], { lodWeight: 1.25, isOccluder: true });
            }
        } else if (hash2D(x * 0.67, z * 0.67, seed + 191) > 0.95) {
            pushBlock(x, 0, z, 'prop', propColor, [blockHalf * 0.45, blockHalf * 0.45, blockHalf * 0.45], { lodWeight: 0.92, isOccluder: false });
        }
    }

    return {
        label: 'Dungeon Blocks',
        level: 'dungeon',
        objects,
        groups,
        config: {
            objectCount: objects.length,
            worldSize: half * cellSize,
            clusterCount: roomCount,
            estimatedVertexLoad: objects.length * 36,
            seed,
        },
    };
}
