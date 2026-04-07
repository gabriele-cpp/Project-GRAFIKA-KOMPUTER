const PRESETS = {
    rice_field: {
        label: 'Rice Field',
        worldSize: 520,
        baseColor: [0.18, 0.5, 0.18],
    },
    forest: {
        label: 'Forest',
        worldSize: 560,
        baseColor: [0.08, 0.25, 0.12],
    },
    classroom: {
        label: 'Classroom',
        worldSize: 180,
        baseColor: [0.22, 0.22, 0.24],
    },
};

const STYLE_LABELS = {
    minecraft: 'Minecraft / Blocky',
};

function random(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function randRange(rand, min, max) {
    return min + rand() * (max - min);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function jitterColor(rand, color, amount = 0.08) {
    return color.map(channel => clamp(channel + randRange(rand, -amount, amount), 0, 1));
}

function pixelColor(rand, color, amount = 0.04) {
    return jitterColor(rand, color, amount).map(channel => Math.round(channel * 12) / 12);
}

function normalizeStyle() {
    return 'minecraft';
}

function makeStyleOptions(options = {}) {
    const style = normalizeStyle(options.style);
    return {
        style,
        blocky: style === 'minecraft',
        blockSize: clamp(Number.parseFloat(options.blockSize) || 1, 0.5, 4),
        densitySimplification: clamp(Number.parseFloat(options.densitySimplification) || 1, 0.25, 1),
    };
}

function snap(value, step) {
    return Math.round(value / step) * step;
}

function snapPosition(pos, styleOptions) {
    if (!styleOptions.blocky || styleOptions.blockSize === 1) return pos;
    const step = styleOptions.blockSize;
    return [
        snap(pos[0], step),
        snap(pos[1], step * 0.5),
        snap(pos[2], step),
    ];
}

function snapScale(scaleVec, styleOptions) {
    if (!styleOptions.blocky || styleOptions.blockSize === 1) return scaleVec;
    const step = Math.max(0.1, styleOptions.blockSize * 0.25);
    return scaleVec.map(value => Math.max(step, snap(value, step)));
}

function styleColor(rand, color, styleOptions, amount = 0.08) {
    return styleOptions.blocky ? pixelColor(rand, color, amount * 0.75) : jitterColor(rand, color, amount);
}

function makeObject(seq, options, styleOptions) {
    const rawScaleVec = options.scaleVec || [options.scale || 1, options.scale || 1, options.scale || 1];
    const scaleVec = snapScale(rawScaleVec, styleOptions);
    const radius = options.radius || Math.max(scaleVec[0], scaleVec[1], scaleVec[2]) * 1.75;
    return {
        id: `generated-${seq}`,
        name: options.name || `Object_${seq}`,
        pos: snapPosition(options.pos || [0, 0, 0], styleOptions),
        color: options.color || [0.2, 0.8, 1.0],
        scale: options.scale || 1,
        scaleVec,
        rotationY: options.rotationY || 0,
        geometry: options.geometry || 'cube',
        category: options.category || 'Object',
        groupId: options.groupId || options.category || 'Object',
        instancedKey: options.instancedKey || options.geometry || 'cube',
        radius,
    };
}

function addObject(objects, targetCount, seqRef, options, styleOptions) {
    if (objects.length >= targetCount) return null;
    const object = makeObject(seqRef.value, options, styleOptions);
    seqRef.value += 1;
    objects.push(object);
    return object;
}

function addTerrain(objects, targetCount, seqRef, preset, size, color, styleOptions) {
    if (styleOptions.blocky) {
        addObject(objects, targetCount, seqRef, {
            name: `${preset}_terrain`,
            category: 'Terrain',
            groupId: `${preset}_terrain`,
            geometry: 'prism',
            instancedKey: 'terrain_block_prism',
            pos: [0, -1.35, 0],
            scaleVec: [size, 0.7, size],
            color,
            radius: size * 1.45,
        }, styleOptions);
        return;
    }

    addObject(objects, targetCount, seqRef, {
        name: `${preset}_terrain`,
        category: 'Terrain',
        groupId: `${preset}_terrain`,
        geometry: 'plane',
        instancedKey: 'terrain_plane',
        pos: [0, -1.1, 0],
        scaleVec: [size, 1, size],
        color,
        radius: size * 1.45,
    }, styleOptions);
}

function addBlockyTerrainSteps(objects, targetCount, seqRef, rand, preset, size, color, styleOptions, count = 8) {
    if (!styleOptions.blocky) return;
    const stepCount = Math.min(count, Math.max(2, Math.floor(targetCount / 160)));
    for (let i = 0; i < stepCount && objects.length < targetCount; i++) {
        const width = randRange(rand, size * 0.18, size * 0.38);
        const depth = randRange(rand, size * 0.04, size * 0.12);
        addObject(objects, targetCount, seqRef, {
            name: `${preset}_terrain_step_${i + 1}`,
            category: 'Terrain',
            groupId: `${preset}_terrain_steps`,
            geometry: 'prism',
            instancedKey: 'terrain_step_prism',
            pos: [
                randRange(rand, -size * 0.36, size * 0.36),
                -0.95 + (i % 3) * 0.18,
                randRange(rand, -size * 0.36, size * 0.36),
            ],
            scaleVec: [width, 0.18, depth],
            rotationY: rand() > 0.5 ? 0 : Math.PI / 2,
            color: pixelColor(rand, color, 0.08),
            radius: width,
        }, styleOptions);
    }
}

function generateRiceField(count, rand, styleOptions) {
    const targetCount = Math.max(1, count);
    const objects = [];
    const seqRef = { value: 1 };
    addTerrain(objects, targetCount, seqRef, 'rice_field', 520, styleColor(rand, [0.18, 0.42, 0.12], styleOptions), styleOptions);
    addBlockyTerrainSteps(objects, targetCount, seqRef, rand, 'rice_field', 520, [0.34, 0.23, 0.12], styleOptions, 12);

    const rows = Math.max(6, Math.floor(Math.sqrt(targetCount) * 1.5));
    const cols = Math.max(8, Math.ceil((targetCount - objects.length) / rows));
    const spacingX = 520 / cols;
    const spacingZ = 380 / rows;

    for (let r = 0; r < rows && objects.length < targetCount; r++) {
        for (let c = 0; c < cols && objects.length < targetCount; c++) {
            const x = -260 + c * spacingX + randRange(rand, -spacingX * 0.3, spacingX * 0.3);
            const z = -190 + r * spacingZ + randRange(rand, -spacingZ * 0.25, spacingZ * 0.25);
            const height = randRange(rand, 0.35, 0.95);
            addObject(objects, targetCount, seqRef, {
                name: `Rice_${seqRef.value}`,
                category: 'Rice',
                groupId: `rice_row_${r + 1}`,
                geometry: styleOptions.blocky ? 'prism' : 'cone',
                instancedKey: styleOptions.blocky ? 'rice_block_prism' : 'rice_cone',
                pos: [x, -0.6 + height * 0.5, z],
                scaleVec: styleOptions.blocky
                    ? [randRange(rand, 0.08, 0.16), height, randRange(rand, 0.08, 0.16)]
                    : [randRange(rand, 0.12, 0.22), height, randRange(rand, 0.12, 0.22)],
                rotationY: styleOptions.blocky ? (rand() > 0.5 ? 0 : Math.PI / 2) : randRange(rand, 0, Math.PI * 2),
                color: styleColor(rand, [0.38, 0.78, 0.2], styleOptions, 0.1),
                radius: height * 1.6,
            }, styleOptions);
        }
    }

    const bunds = Math.min(12, Math.max(2, Math.floor(targetCount / 120)));
    for (let i = 0; i < bunds && objects.length < targetCount; i++) {
        const z = -220 + i * (440 / Math.max(1, bunds - 1));
        addObject(objects, targetCount, seqRef, {
            name: `Field_Bund_${i + 1}`,
            category: 'Field Bund',
            groupId: 'rice_field_bunds',
            geometry: 'prism',
            instancedKey: styleOptions.blocky ? 'field_bund_block' : 'field_bund_prism',
            pos: [0, -0.95, z],
            scaleVec: [270, 0.22, 1.2],
            color: styleColor(rand, [0.34, 0.23, 0.12], styleOptions, 0.04),
            radius: 270,
        }, styleOptions);
    }

    return makeSceneResult('rice_field', objects, styleOptions);
}

function generateForest(count, rand, styleOptions) {
    const targetCount = Math.max(1, count);
    const objects = [];
    const seqRef = { value: 1 };
    addTerrain(objects, targetCount, seqRef, 'forest', 560, styleColor(rand, [0.08, 0.22, 0.1], styleOptions), styleOptions);
    addBlockyTerrainSteps(objects, targetCount, seqRef, rand, 'forest', 560, [0.14, 0.28, 0.1], styleOptions, 10);

    while (objects.length < targetCount) {
        const treeIndex = seqRef.value;
        const x = randRange(rand, -260, 260);
        const z = randRange(rand, -260, 260);
        const trunkHeight = randRange(rand, 3.2, 8.2);
        const trunkRadius = randRange(rand, 0.35, 0.85);
        const canopy = randRange(rand, 2.0, 4.8);
        const groupId = `tree_${treeIndex}`;

        addObject(objects, targetCount, seqRef, {
            name: `Tree_Trunk_${treeIndex}`,
            category: 'Tree',
            groupId,
            geometry: styleOptions.blocky ? 'prism' : 'cylinder',
            instancedKey: styleOptions.blocky ? 'tree_trunk_block' : 'tree_trunk_cylinder',
            pos: [x, -1 + trunkHeight * 0.5, z],
            scaleVec: [trunkRadius, trunkHeight, trunkRadius],
            rotationY: styleOptions.blocky ? (rand() > 0.5 ? 0 : Math.PI / 2) : 0,
            color: styleColor(rand, [0.34, 0.2, 0.1], styleOptions, 0.06),
            radius: trunkHeight,
        }, styleOptions);

        if (styleOptions.blocky) {
            addBlockyLeaves(objects, targetCount, seqRef, rand, x, z, trunkHeight, canopy, groupId, treeIndex, styleOptions);
        } else {
            addNormalCanopy(objects, targetCount, seqRef, rand, x, z, trunkHeight, canopy, groupId, treeIndex, styleOptions);
        }

        if (rand() > 0.72) {
            addObject(objects, targetCount, seqRef, {
                name: `Rock_${treeIndex}`,
                category: 'Rock',
                groupId: `rock_${treeIndex}`,
                geometry: styleOptions.blocky ? 'prism' : 'sphere',
                instancedKey: styleOptions.blocky ? 'rock_block' : 'rock_sphere',
                pos: [x + randRange(rand, -4, 4), -0.85, z + randRange(rand, -4, 4)],
                scaleVec: [randRange(rand, 0.7, 1.8), randRange(rand, 0.35, 0.9), randRange(rand, 0.7, 1.8)],
                rotationY: randRange(rand, 0, Math.PI * 2),
                color: styleColor(rand, [0.28, 0.3, 0.28], styleOptions, 0.05),
            }, styleOptions);
        }
    }

    return makeSceneResult('forest', objects, styleOptions);
}

function addNormalCanopy(objects, targetCount, seqRef, rand, x, z, trunkHeight, canopy, groupId, treeIndex, styleOptions) {
    addObject(objects, targetCount, seqRef, {
        name: `Tree_Canopy_${treeIndex}`,
        category: 'Tree',
        groupId,
        geometry: 'sphere',
        instancedKey: 'tree_canopy_sphere',
        pos: [x, -1 + trunkHeight + canopy * 0.35, z],
        scaleVec: [canopy, canopy * 0.9, canopy],
        color: styleColor(rand, [0.08, 0.45, 0.16], styleOptions, 0.12),
        radius: canopy * 2,
    }, styleOptions);

    if (rand() > 0.45) {
        addObject(objects, targetCount, seqRef, {
            name: `Tree_Top_${treeIndex}`,
            category: 'Tree',
            groupId,
            geometry: 'cone',
            instancedKey: 'tree_top_cone',
            pos: [x, -1 + trunkHeight + canopy * 1.1, z],
            scaleVec: [canopy * 0.72, canopy * 0.9, canopy * 0.72],
            rotationY: randRange(rand, 0, Math.PI * 2),
            color: styleColor(rand, [0.06, 0.35, 0.12], styleOptions, 0.1),
            radius: canopy * 1.5,
        }, styleOptions);
    }
}

function addBlockyLeaves(objects, targetCount, seqRef, rand, x, z, trunkHeight, canopy, groupId, treeIndex, styleOptions) {
    const leafSize = canopy * randRange(rand, 0.75, 1.1);
    const leafOffsets = [
        [0, 0, 0, 1.15],
        [1, -0.15, 0, 0.78],
        [-1, -0.12, 0, 0.78],
        [0, -0.1, 1, 0.78],
        [0, -0.08, -1, 0.78],
        [0, 0.85, 0, 0.68],
    ];
    for (const [ox, oy, oz, s] of leafOffsets) {
        addObject(objects, targetCount, seqRef, {
            name: `Tree_Leaf_${treeIndex}_${seqRef.value}`,
            category: 'Tree',
            groupId,
            geometry: 'cube',
            instancedKey: 'tree_leaf_block',
            pos: [
                x + ox * leafSize * 0.72,
                -1 + trunkHeight + canopy * 0.45 + oy * leafSize,
                z + oz * leafSize * 0.72,
            ],
            scaleVec: [leafSize * s, leafSize * s, leafSize * s],
            rotationY: rand() > 0.5 ? 0 : Math.PI / 2,
            color: styleColor(rand, [0.08, 0.45, 0.16], styleOptions, 0.12),
            radius: leafSize * s * 2,
        }, styleOptions);
    }
}

function generateClassroom(count, rand, styleOptions) {
    const targetCount = Math.max(1, count);
    const objects = [];
    const seqRef = { value: 1 };
    addTerrain(objects, targetCount, seqRef, 'classroom', 80, styleColor(rand, [0.28, 0.26, 0.22], styleOptions), styleOptions);
    addBlockyTerrainSteps(objects, targetCount, seqRef, rand, 'classroom_floor', 80, [0.34, 0.3, 0.24], styleOptions, 5);

    const staticParts = [
        ['Back_Wall', 'Wall', [0, 18, -52], [58, 18, 1.2], [0.58, 0.6, 0.58]],
        ['Left_Wall', 'Wall', [-58, 18, 0], [1.2, 18, 52], [0.5, 0.52, 0.55]],
        ['Right_Wall', 'Wall', [58, 18, 0], [1.2, 18, 52], [0.5, 0.52, 0.55]],
        ['Whiteboard', 'Board', [0, 12, -50.2], [22, 5, 0.35], [0.88, 0.95, 0.9]],
        ['Teacher_Table', 'Table', [0, 1.8, -35], [8, 1.2, 2.5], [0.42, 0.24, 0.12]],
    ];

    for (const [name, category, pos, scaleVec, color] of staticParts) {
        addObject(objects, targetCount, seqRef, {
            name,
            category,
            groupId: name.toLowerCase(),
            geometry: 'prism',
            instancedKey: `${category.toLowerCase()}_prism`,
            pos,
            scaleVec,
            color: styleColor(rand, color, styleOptions, 0.04),
            radius: Math.max(...scaleVec) * 1.7,
        }, styleOptions);
    }

    const rowCount = Math.min(6, Math.max(2, Math.floor(Math.sqrt(targetCount / 8))));
    const colCount = Math.min(7, Math.max(3, Math.ceil(targetCount / Math.max(1, rowCount * 10))));
    const startX = -((colCount - 1) * 6);
    const startZ = -18;

    for (let r = 0; r < rowCount && objects.length < targetCount; r++) {
        for (let c = 0; c < colCount && objects.length < targetCount; c++) {
            const x = startX + c * 10 + randRange(rand, -0.35, 0.35);
            const z = startZ + r * 10 + randRange(rand, -0.35, 0.35);
            const groupId = `desk_set_${r + 1}_${c + 1}`;
            addDeskSet(objects, targetCount, seqRef, rand, x, z, groupId, styleOptions);
        }
    }

    while (objects.length < targetCount) {
        const x = randRange(rand, -48, 48);
        const z = randRange(rand, -28, 42);
        const typeRoll = rand();
        if (typeRoll < 0.72) {
            addObject(objects, targetCount, seqRef, {
                name: `Book_${seqRef.value}`,
                category: 'Book',
                groupId: 'classroom_small_props',
                geometry: 'prism',
                instancedKey: 'book_prism',
                pos: [x, 2.75, z],
                scaleVec: [randRange(rand, 0.45, 0.9), 0.06, randRange(rand, 0.25, 0.65)],
                rotationY: randRange(rand, 0, Math.PI * 2),
                color: styleColor(rand, [0.12, 0.22, 0.65], styleOptions, 0.14),
            }, styleOptions);
        } else {
            addObject(objects, targetCount, seqRef, {
                name: `Bag_${seqRef.value}`,
                category: 'Bag',
                groupId: 'classroom_small_props',
                geometry: styleOptions.blocky ? 'prism' : 'sphere',
                instancedKey: styleOptions.blocky ? 'bag_block' : 'bag_sphere',
                pos: [x, 0.2, z],
                scaleVec: [randRange(rand, 0.45, 0.8), randRange(rand, 0.25, 0.55), randRange(rand, 0.35, 0.7)],
                rotationY: randRange(rand, 0, Math.PI * 2),
                color: styleColor(rand, [0.08, 0.08, 0.1], styleOptions, 0.1),
            }, styleOptions);
        }
    }

    return makeSceneResult('classroom', objects, styleOptions);
}

function addDeskSet(objects, targetCount, seqRef, rand, x, z, groupId, styleOptions) {
    const wood = styleColor(rand, [0.46, 0.26, 0.12], styleOptions, 0.05);
    const metal = styleColor(rand, [0.42, 0.45, 0.48], styleOptions, 0.02);
    addObject(objects, targetCount, seqRef, {
        name: `Desk_Top_${seqRef.value}`,
        category: 'Table',
        groupId,
        geometry: 'prism',
        instancedKey: 'student_table_top',
        pos: [x, 2.3, z],
        scaleVec: [3.8, 0.22, 2.4],
        color: wood,
    }, styleOptions);
    addObject(objects, targetCount, seqRef, {
        name: `Chair_Seat_${seqRef.value}`,
        category: 'Chair',
        groupId,
        geometry: 'prism',
        instancedKey: 'chair_seat',
        pos: [x, 1.3, z + 3.0],
        scaleVec: [2.2, 0.18, 1.8],
        color: styleColor(rand, [0.16, 0.32, 0.62], styleOptions, 0.04),
    }, styleOptions);
    addObject(objects, targetCount, seqRef, {
        name: `Chair_Back_${seqRef.value}`,
        category: 'Chair',
        groupId,
        geometry: 'prism',
        instancedKey: 'chair_back',
        pos: [x, 2.5, z + 4.0],
        scaleVec: [2.2, 1.2, 0.18],
        color: styleColor(rand, [0.14, 0.28, 0.56], styleOptions, 0.04),
    }, styleOptions);

    for (const [lx, lz] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) {
        addObject(objects, targetCount, seqRef, {
            name: `Desk_Leg_${seqRef.value}`,
            category: 'Table',
            groupId,
            geometry: styleOptions.blocky ? 'prism' : 'cylinder',
            instancedKey: styleOptions.blocky ? 'desk_leg_block' : 'desk_leg_cylinder',
            pos: [x + lx, 1.0, z + lz],
            scaleVec: [0.12, 1.2, 0.12],
            color: metal,
        }, styleOptions);
    }
}

function summarizeGroups(objects) {
    const groups = {};
    for (const object of objects) {
        groups[object.category] = (groups[object.category] || 0) + 1;
    }
    return groups;
}

function makeSceneResult(preset, objects, styleOptions) {
    const presetLabel = PRESETS[preset].label;
    return {
        preset,
        style: styleOptions.style,
        label: `${presetLabel} - ${STYLE_LABELS[styleOptions.style]}`,
        objects,
        groups: summarizeGroups(objects),
    };
}

export function generateEnvironmentScene(preset = 'rice_field', count = 500, options = {}) {
    const selectedPreset = PRESETS[preset] ? preset : 'rice_field';
    const styleOptions = makeStyleOptions(options);
    const seed = options.seed ?? Date.now();
    const rand = random(seed);
    const rawCount = Math.max(1, Math.min(50000, Number.parseInt(count, 10) || 500));
    const targetCount = styleOptions.blocky
        ? Math.max(1, Math.floor(rawCount * styleOptions.densitySimplification))
        : rawCount;

    if (selectedPreset === 'forest') return generateForest(targetCount, rand, styleOptions);
    if (selectedPreset === 'classroom') return generateClassroom(targetCount, rand, styleOptions);
    return generateRiceField(targetCount, rand, styleOptions);
}

export const ENVIRONMENT_PRESETS = Object.keys(PRESETS).map(id => ({
    id,
    label: PRESETS[id].label,
}));
