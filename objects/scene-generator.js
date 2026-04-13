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

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function tintColor(base, variance = 0.18) {
    return [
        clamp01(base[0] + (Math.random() - 0.5) * variance),
        clamp01(base[1] + (Math.random() - 0.5) * variance),
        clamp01(base[2] + (Math.random() - 0.5) * variance),
    ];
}

function chooseCategory() {
    const total = CATEGORY_LIBRARY.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
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

function makeObject(id, category, preset, palette, clusterCenter, laneIndex) {
    const spread = preset.worldSize * (category.id === 'terrain' ? 0.9 : 0.12 + Math.random() * 0.14);
    const scaleFactor = preset.baseScaleRange[0] + Math.random() * (preset.baseScaleRange[1] - preset.baseScaleRange[0]);
    const baseScale = category.scale || [1, 1, 1];
    const scaleVec = [
        Math.max(0.3, baseScale[0] * scaleFactor * (0.85 + Math.random() * 0.3)),
        Math.max(0.3, baseScale[1] * scaleFactor * (0.85 + Math.random() * 0.35)),
        Math.max(0.3, baseScale[2] * scaleFactor * (0.85 + Math.random() * 0.3)),
    ];

    const laneOffset = (laneIndex - (preset.laneCount - 1) * 0.5) * (preset.worldSize * 0.14);
    const position = category.id === 'terrain'
        ? [
            (Math.random() - 0.5) * preset.worldSize * 1.6,
            -8 - Math.random() * 12,
            (Math.random() - 0.5) * preset.worldSize * 1.6,
        ]
        : [
            clusterCenter[0] + (Math.random() - 0.5) * spread,
            Math.round((Math.random() - 0.5) * preset.floorCount) * (preset.verticalRange / Math.max(1, preset.floorCount)),
            clusterCenter[2] + laneOffset + (Math.random() - 0.5) * spread,
        ];

    const color = tintColor(palette[id % palette.length], category.id === 'terrain' ? 0.08 : 0.18);
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
        rotationY: Math.random() * Math.PI * 2,
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

export function generateComplexityScene(level = 'medium', paletteIdx = 0) {
    const preset = COMPLEXITY_PRESETS[level] || COMPLEXITY_PRESETS.medium;
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
        const category = chooseCategory();
        const clusterCenter = clusterCenters[index % clusterCenters.length];
        const laneIndex = index % preset.laneCount;
        const object = makeObject(index, category, preset, palette, clusterCenter, laneIndex);
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
        },
    };
}
