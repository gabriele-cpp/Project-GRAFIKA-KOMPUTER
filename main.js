import { Renderer } from './engine/renderer.js';
import { Shader } from './engine/shader.js';
import { Camera } from './engine/camera.js';
import { Mesh } from './engine/mesh.js';
import { Frustum } from './culling/frustum.js';
import { Octree } from './culling/octree.js';
import { LOD } from './culling/lod.js';
import { OcclusionCuller } from './culling/occlusion.js';
import { HybridCullingPipeline } from './culling/hybrid-pipeline.js';
import { generateObjects, generateClustered } from './objects/objects.js';
import { generateComplexityScene, generateVoxelWorld, generateDungeonWorld } from './objects/scene-generator.js';
import { PerformanceMonitor } from './engine/performance.js';
import { AdaptiveQualityManager } from './engine/adaptive-quality.js';
import { CameraPathSystem } from './engine/camera-path.js';
import { BenchmarkRunner } from './engine/benchmark.js';
import { ChartPanel } from './ui/chart-panel.js';
import { LeftPanel } from './ui/left-panel.js';
import { ResearchPanel } from './ui/research-panel.js';
import { createGeometry, GEOMETRY_TYPES } from './engine/geometry.js';
import { ModelImporter } from './engine/model-importer.js';
import { ImportPanel } from './ui/import-panel.js';
import { HudOverlay } from './ui/hud.js';
import { mountUI } from './ui/bootstrap.js';

const vertexShaderCode = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    attribute vec3 aVertexColor;
    uniform vec4 uOffset;
    uniform float uScale;
    uniform vec3 uScaleVec;
    uniform float uRotationY;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    varying vec3 vColor;

    void main() {
        vec3 scaled = aVertexPosition.xyz * uScaleVec * uScale;
        float c = cos(uRotationY);
        float s = sin(uRotationY);
        vec3 rotated = vec3(
            scaled.x * c - scaled.z * s,
            scaled.y,
            scaled.x * s + scaled.z * c
        );
        vec4 finalPosition = vec4(rotated, 1.0) + uOffset;
        gl_Position = uProjectionMatrix * uViewMatrix * finalPosition;
        vNormal = vec3(
            aVertexNormal.x * c - aVertexNormal.z * s,
            aVertexNormal.y,
            aVertexNormal.x * s + aVertexNormal.z * c
        );
        vColor = aVertexColor;
    }
`;

const fragmentShaderCode = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    uniform vec3 uLightDirection;
    uniform vec3 uBaseColor;
    uniform bool uUseVertexColor;
    uniform float uLodLevel;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightDirection);
        float diffuse = max(dot(normal, lightDir), 0.0);

        vec3 baseColor = uUseVertexColor ? vColor : uBaseColor;
        vec3 baseNeon = baseColor * 0.9;
        vec3 highlight = baseColor * diffuse * 0.6;
        vec3 finalColor = baseNeon + highlight;

        if (uLodLevel > 0.5) {
            if (uLodLevel < 1.5) finalColor = mix(finalColor, vec3(1.0, 1.0, 0.0), 0.4);
            else finalColor = mix(finalColor, vec3(1.0, 0.2, 0.0), 0.5);
        }

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const instancedVertexShaderCode = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    attribute vec3 aInstanceOffset;
    attribute vec3 aInstanceColor;
    attribute vec3 aInstanceScaleVec;
    attribute float aInstanceScale;
    attribute float aInstanceRotationY;
    attribute float aInstanceLod;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vLod;

    void main() {
        vec3 scaled = aVertexPosition.xyz * aInstanceScaleVec * aInstanceScale;
        float c = cos(aInstanceRotationY);
        float s = sin(aInstanceRotationY);
        vec3 rotated = vec3(
            scaled.x * c - scaled.z * s,
            scaled.y,
            scaled.x * s + scaled.z * c
        );
        vec4 finalPosition = vec4(rotated + aInstanceOffset, 1.0);
        gl_Position = uProjectionMatrix * uViewMatrix * finalPosition;
        vNormal = vec3(
            aVertexNormal.x * c - aVertexNormal.z * s,
            aVertexNormal.y,
            aVertexNormal.x * s + aVertexNormal.z * c
        );
        vColor = aInstanceColor;
        vLod = aInstanceLod;
    }
`;

const instancedFragmentShaderCode = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vLod;
    uniform vec3 uLightDirection;
    uniform bool uShowLodColor;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightDirection);
        float diffuse = max(dot(normal, lightDir), 0.0);
        vec3 baseNeon = vColor * 0.9;
        vec3 highlight = vColor * diffuse * 0.6;
        vec3 finalColor = baseNeon + highlight;

        if (uShowLodColor && vLod > 0.5) {
            if (vLod < 1.5) finalColor = mix(finalColor, vec3(1.0, 1.0, 0.0), 0.4);
            else finalColor = mix(finalColor, vec3(1.0, 0.2, 0.0), 0.5);
        }
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const bbVertexCode = `
    attribute vec4 aVertexPosition;
    uniform vec4 uOffset;
    uniform float uScale;
    uniform vec3 uScaleVec;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main() {
        vec4 scaledPos = vec4(aVertexPosition.xyz * uScale * uScaleVec, 1.0);
        gl_Position = uProjectionMatrix * uViewMatrix * (scaledPos + uOffset);
    }
`;

const bbFragmentCode = `
    precision mediump float;
    uniform vec3 uBBoxColor;
    void main() { gl_FragColor = vec4(uBBoxColor, 1.0); }
`;

function createBBoxMesh(gl) {
    const vertices = new Float32Array([
        -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
        -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);
    const indices = new Uint16Array([
        0, 1, 1, 2, 2, 3, 3, 0,
        4, 5, 5, 6, 6, 7, 7, 4,
        0, 4, 1, 5, 2, 6, 3, 7,
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return { vertexBuffer, indexBuffer, count: indices.length };
}

function downloadText(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    anchor.click();
}

function randomSeed() {
    return Math.floor(Math.random() * 1_000_000_000);
}

const renderer = new Renderer('gameCanvas');
const gl = renderer.gl;
const shader = new Shader(gl, vertexShaderCode, fragmentShaderCode);
const instancedShader = new Shader(gl, instancedVertexShaderCode, instancedFragmentShaderCode);
const bbShader = new Shader(gl, bbVertexCode, bbFragmentCode);
const bbox = createBBoxMesh(gl);
const instancingExt = renderer.capabilities.webgl2 ? null : gl.getExtension('ANGLE_instanced_arrays');
const instancingAvailable = renderer.capabilities.webgl2 || !!instancingExt;

const aspect = renderer.canvas.width / renderer.canvas.height;
const camera = new Camera(Math.PI / 4, aspect, 0.1, 2000.0);
window.addEventListener('resize', () => {
    camera.updateAspect(renderer.canvas.width / renderer.canvas.height);
});

const frustum = new Frustum();
const octree = new Octree(650, 5, 24);
const lod = new LOD();
const occlusion = new OcclusionCuller();
const hybridPipeline = new HybridCullingPipeline({ frustum, octree, occlusion, lod });
const perfMonitor = new PerformanceMonitor(gl);
const adaptiveQuality = new AdaptiveQualityManager(60);
const cameraPath = new CameraPathSystem();
const benchmarkRunner = new BenchmarkRunner();
const chartPanel = new ChartPanel();
const leftPanel = new LeftPanel();
const researchPanel = new ResearchPanel();
const importPanel = new ImportPanel();
const modelImporter = new ModelImporter();
const hud = new HudOverlay();

const uniformLocations = {
    view: gl.getUniformLocation(shader.program, 'uViewMatrix'),
    projection: gl.getUniformLocation(shader.program, 'uProjectionMatrix'),
    offset: gl.getUniformLocation(shader.program, 'uOffset'),
    scale: gl.getUniformLocation(shader.program, 'uScale'),
    scaleVec: gl.getUniformLocation(shader.program, 'uScaleVec'),
    rotationY: gl.getUniformLocation(shader.program, 'uRotationY'),
    lightDir: gl.getUniformLocation(shader.program, 'uLightDirection'),
    baseColor: gl.getUniformLocation(shader.program, 'uBaseColor'),
    useVertexColor: gl.getUniformLocation(shader.program, 'uUseVertexColor'),
    lodLevel: gl.getUniformLocation(shader.program, 'uLodLevel'),
};

const instancedUniformLocations = {
    view: gl.getUniformLocation(instancedShader.program, 'uViewMatrix'),
    projection: gl.getUniformLocation(instancedShader.program, 'uProjectionMatrix'),
    lightDir: gl.getUniformLocation(instancedShader.program, 'uLightDirection'),
    showLodColor: gl.getUniformLocation(instancedShader.program, 'uShowLodColor'),
};

const instancedBuffers = {
    offset: gl.createBuffer(),
    color: gl.createBuffer(),
    scaleVec: gl.createBuffer(),
    scale: gl.createBuffer(),
    rotation: gl.createBuffer(),
    lod: gl.createBuffer(),
};

const bbUniformLocations = {
    view: gl.getUniformLocation(bbShader.program, 'uViewMatrix'),
    projection: gl.getUniformLocation(bbShader.program, 'uProjectionMatrix'),
    offset: gl.getUniformLocation(bbShader.program, 'uOffset'),
    scale: gl.getUniformLocation(bbShader.program, 'uScale'),
    scaleVec: gl.getUniformLocation(bbShader.program, 'uScaleVec'),
    color: gl.getUniformLocation(bbShader.program, 'uBBoxColor'),
};

const lightDirection = [0.8, 1.0, 0.5];

let activeMesh = new Mesh(gl);
let currentGeoType = 'cube';
let savedGeneratedObjects = [];
const meshCache = new Map([['cube', activeMesh]]);

const state = {
    useFrustum: true,
    useOctree: true,
    useOcclusion: false,
    useLOD: false,
    useTemporalCoherence: true,
    usePredictiveCulling: true,
    useInstancing: true,
    useAdaptiveBudget: false,
    showBBox: false,
    showLODColor: false,
    showHeatmap: false,
    showOcclusionGrid: false,
    objectCount: 500,
    mode: 'minecraft',
    paletteIdx: 0,
    complexity: 'medium',
    sceneSeed: randomSeed(),
    environmentLabel: 'Random',
    environmentGroups: {},
    occlusionResolution: 24,
    lodNear: lod.nearThreshold,
    lodMid: lod.midThreshold,
    lodFar: lod.farThreshold,
    lodTransitionBand: lod.transitionBand,
    cameraPathSmoothing: true,
    cameraPathConstantSpeed: true,
    qualityProfile: 'high',
    budgetAverageFps: 0,
    shadowQuality: 0.85,
    postProcessScale: 0.9,
    dynamicLodDistanceScale: 1.0,
    lastStageStats: null,
};

if (!instancingAvailable) {
    state.useInstancing = false;
}

const sceneRegistry = {
    generated: new Map(),
    imported: new Map(),
    importedSelectedId: null,
};

let generatedObjects = [];
let speed = 1.5;
let turnSpeed = 0.03;
const keys = {};
let mouseDown = false;
const benchmarkMatrix = {
    active: false,
    queue: [],
    runs: [],
    current: null,
};

const occlusionOverlay = document.createElement('canvas');
occlusionOverlay.width = 160;
occlusionOverlay.height = 160;
occlusionOverlay.style.cssText = 'position:fixed;right:18px;top:18px;width:160px;height:160px;border:1px solid rgba(124,242,255,0.5);background:rgba(0,0,0,0.55);z-index:140;display:none;image-rendering:pixelated;pointer-events:none;';
document.body.appendChild(occlusionOverlay);
const occlusionOverlayCtx = occlusionOverlay.getContext('2d');

function getMeshForType(type = 'cube') {
    const meshType = GEOMETRY_TYPES.includes(type) ? type : 'cube';
    if (!meshCache.has(meshType)) {
        meshCache.set(meshType, meshType === 'cube' ? new Mesh(gl) : createGeometry(gl, meshType));
    }
    return meshCache.get(meshType);
}

function setAttribDivisor(location, divisor) {
    if (location < 0) return;
    if (renderer.capabilities.webgl2) {
        gl.vertexAttribDivisor(location, divisor);
    } else if (instancingExt?.vertexAttribDivisorANGLE) {
        instancingExt.vertexAttribDivisorANGLE(location, divisor);
    }
}

function drawElementsInstanced(indexCount, indexType, instanceCount) {
    if (renderer.capabilities.webgl2) {
        gl.drawElementsInstanced(gl.TRIANGLES, indexCount, indexType, 0, instanceCount);
    } else if (instancingExt?.drawElementsInstancedANGLE) {
        instancingExt.drawElementsInstancedANGLE(gl.TRIANGLES, indexCount, indexType, 0, instanceCount);
    }
}

function getMeshIndexType(mesh) {
    return mesh.indexType || gl.UNSIGNED_SHORT;
}

function getGeneratedBounds(object) {
    if (object.bounds) return object.bounds;
    const scaleVec = object.scaleVec || [object.scale || 1, object.scale || 1, object.scale || 1];
    const halfSize = scaleVec.map(value => Math.max(Math.abs(value), 0.05));
    const radius = Math.max(Math.hypot(halfSize[0], halfSize[1], halfSize[2]), 0.1);
    return {
        center: [...object.pos],
        halfSize,
        radius,
        min: [
            object.pos[0] - halfSize[0],
            object.pos[1] - halfSize[1],
            object.pos[2] - halfSize[2],
        ],
        max: [
            object.pos[0] + halfSize[0],
            object.pos[1] + halfSize[1],
            object.pos[2] + halfSize[2],
        ],
    };
}

function normalizeGeneratedObjects(objects) {
    return objects.map((object, index) => {
        const normalized = {
            ...object,
            id: object.id || `generated-${index + 1}`,
            name: object.name || `Object_${index + 1}`,
            source: 'generated',
            cullingSource: 'generated',
            color: object.color || [0.2, 0.8, 1.0],
            scale: object.scale || 1,
            scaleVec: object.scaleVec || [object.scale || 1, object.scale || 1, object.scale || 1],
            geometry: object.geometry || currentGeoType,
            category: object.category || 'Generated',
            rotationY: object.rotationY || 0,
            groupId: object.groupId || 'generated',
            instancedKey: object.instancedKey || object.geometry || currentGeoType,
            polygonWeight: object.polygonWeight || 1,
            lodWeight: object.lodWeight || 1,
            isOccluder: object.isOccluder || false,
        };
        normalized.bounds = getGeneratedBounds(normalized);
        return normalized;
    });
}

function registerGeneratedObjects(objects) {
    sceneRegistry.generated.clear();
    objects.forEach(object => {
        sceneRegistry.generated.set(object.id, {
            id: object.id,
            name: object.name,
            type: object.category || object.geometry || currentGeoType,
            groupId: object.groupId || 'generated',
            geometry: object.geometry || currentGeoType,
            instancedKey: object.instancedKey || object.geometry || currentGeoType,
            position: object.pos,
            scale: object.scaleVec || [object.scale || 1, object.scale || 1, object.scale || 1],
            source: 'generated',
            ref: object,
        });
    });
}

function syncImportedRegistry(objects = [], selectedId = null) {
    sceneRegistry.imported.clear();
    objects.forEach(object => {
        sceneRegistry.imported.set(object.id, {
            ...object,
            source: 'imported',
        });
    });
    sceneRegistry.importedSelectedId = selectedId;
}

function getSceneObjectCount() {
    return sceneRegistry.generated.size + sceneRegistry.imported.size;
}

function syncSceneUI() {
    importPanel.setObjectRegistry?.([...sceneRegistry.imported.values()], sceneRegistry.importedSelectedId);
    leftPanel.syncSceneControls?.({
        count: state.objectCount,
        mode: state.mode,
        paletteIdx: state.paletteIdx,
    });
    leftPanel.syncState?.(state);
    leftPanel.updateSceneSummary?.(state.environmentLabel, state.environmentGroups, sceneRegistry.generated.size);
    researchPanel.syncState(state);
}

function rebuildScene(objects) {
    generatedObjects = normalizeGeneratedObjects(objects);
    octree.rebuild(generatedObjects);
    registerGeneratedObjects(generatedObjects);
    syncSceneUI();
}

function regenerateObjects() {
    if (currentGeoType === 'none') {
        generatedObjects = [];
        savedGeneratedObjects = [];
        octree.rebuild(generatedObjects);
        registerGeneratedObjects(generatedObjects);
        syncSceneUI();
        return;
    }

    let objects = [];
    if (state.mode === 'clustered') {
        objects = generateClustered(state.objectCount, 500, 12, state.sceneSeed);
        state.environmentLabel = 'Clustered';
        state.environmentGroups = { Clustered: objects.length };
    } else if (state.mode === 'minecraft') {
        const minecraftTarget = Math.max(12000, state.objectCount);
        if (minecraftTarget !== state.objectCount) {
            state.objectCount = minecraftTarget;
        }
        const world = generateVoxelWorld({
            targetCount: minecraftTarget,
            paletteIdx: state.paletteIdx,
            seed: state.sceneSeed,
        });
        objects = world.objects;
        state.environmentLabel = world.label;
        state.environmentGroups = world.groups;
    } else if (state.mode === 'dungeon') {
        const dungeonTarget = Math.max(10000, state.objectCount);
        if (dungeonTarget !== state.objectCount) {
            state.objectCount = dungeonTarget;
        }
        const world = generateDungeonWorld({
            targetCount: dungeonTarget,
            paletteIdx: state.paletteIdx,
            seed: state.sceneSeed,
        });
        objects = world.objects;
        state.environmentLabel = world.label;
        state.environmentGroups = world.groups;
    } else {
        objects = generateObjects(state.objectCount, 500, state.paletteIdx, state.sceneSeed);
        state.environmentLabel = 'Random';
        state.environmentGroups = { [state.environmentLabel]: objects.length };
    }
    rebuildScene(objects);
}

function generateComplexityPreset(level = 'medium') {
    const scene = generateComplexityScene(level, state.paletteIdx, { seed: state.sceneSeed });
    state.complexity = level;
    state.objectCount = scene.objects.length;
    state.environmentLabel = scene.label;
    state.environmentGroups = scene.groups;
    rebuildScene(scene.objects);
    hud.showToast(`${scene.label} generated for benchmark experiments.`);
}

function clearGeneratedScene() {
    generatedObjects = [];
    savedGeneratedObjects = [];
    state.objectCount = 0;
    state.environmentLabel = 'Empty';
    state.environmentGroups = {};
    octree.rebuild(generatedObjects);
    registerGeneratedObjects(generatedObjects);
    syncSceneUI();
}

function setGeometryType(type) {
    const previousType = currentGeoType;
    currentGeoType = type;

    if (type === 'none') {
        savedGeneratedObjects = generatedObjects.slice();
        rebuildScene([]);
        return;
    }

    activeMesh = type === 'cube' ? getMeshForType('cube') : getMeshForType(type);
    const sourceObjects = previousType === 'none' && savedGeneratedObjects.length > 0
        ? savedGeneratedObjects.slice()
        : generatedObjects.slice();
    rebuildScene(sourceObjects.map(object => ({
        ...object,
        geometry: object.lockGeometry
            ? (object.geometry || 'cube')
            : (object.geometry === 'plane' ? 'plane' : type),
        instancedKey: object.lockGeometry
            ? (object.instancedKey || `voxel:${object.groupId || 'generated'}:${object.geometry || 'cube'}`)
            : `${object.groupId || 'generated'}:${object.geometry === 'plane' ? 'plane' : type}`,
    })));
}

function exportPerformanceJSON() {
    const snapshot = perfMonitor.snapshot;
    downloadText(
        `perf_export_${Date.now()}.json`,
        JSON.stringify({
            timestamp: new Date().toISOString(),
            fps: snapshot.fps,
            frameTime: snapshot.cpuFrameMs,
            gpuFrameTime: snapshot.gpuFrameMs,
            drawCalls: snapshot.drawCalls,
            vertexCount: snapshot.vertexCount,
            totalObjects: getSceneObjectCount(),
            renderedObjects: snapshot.rendered,
            culledObjects: snapshot.culledTotal,
            cullingEfficiency: `${snapshot.cullEff}%`,
            octreeDepth: snapshot.octreeDepth,
            stageStats: snapshot.stageStats,
            state: {
                useFrustum: state.useFrustum,
                useOctree: state.useOctree,
                useOcclusion: state.useOcclusion,
                useLOD: state.useLOD,
                useTemporalCoherence: state.useTemporalCoherence,
                usePredictiveCulling: state.usePredictiveCulling,
                useInstancing: state.useInstancing,
                qualityProfile: state.qualityProfile,
                sceneSeed: state.sceneSeed,
            },
            renderer: renderer.capabilities,
        }, null, 2),
        'application/json'
    );
    hud.showToast('Performance snapshot exported as JSON.');
}

function exportCameraPath() {
    if (!cameraPath.recordedPath?.samples?.length) {
        hud.showToast('Record a camera path first.');
        return;
    }
    downloadText(`camera_path_${Date.now()}.json`, cameraPath.exportJSON(), 'application/json');
}

function exportBenchmark(format = 'json') {
    if (!benchmarkRunner.results.length && !benchmarkRunner.samples.length) {
        hud.showToast('Run benchmark first.');
        return;
    }
    if (format === 'csv') {
        downloadText(`benchmark_${Date.now()}.csv`, benchmarkRunner.exportCSV(), 'text/csv');
    } else {
        downloadText(`benchmark_${Date.now()}.json`, benchmarkRunner.exportJSON(), 'application/json');
    }
}

function startBenchmark() {
    if (benchmarkMatrix.active) {
        benchmarkMatrix.active = false;
        benchmarkMatrix.queue = [];
        benchmarkMatrix.runs = [];
        benchmarkMatrix.current = null;
    }
    if (!cameraPath.recordedPath?.samples?.length) {
        hud.showToast('Record or import a camera path before benchmark.');
        return;
    }
    const technique = benchmarkRunner.start(cameraPath.recordedPath, {
        label: 'camera-benchmark',
        sceneLabel: state.environmentLabel,
        sceneSeed: state.sceneSeed,
        warmupFrames: 30,
    });
    cameraPath.startReplay(cameraPath.recordedPath, {
        loop: false,
        smoothing: state.cameraPathSmoothing,
        constantSpeed: state.cameraPathConstantSpeed,
    });
    hud.showToast(`Benchmark started with ${technique.label}.`);
}

function buildBenchmarkMatrixQueue() {
    return [
        { key: 'low', kind: 'complexity', level: 'low', seedOffset: 0 },
        { key: 'medium', kind: 'complexity', level: 'medium', seedOffset: 17 },
        { key: 'high', kind: 'complexity', level: 'high', seedOffset: 33 },
        { key: 'voxel', kind: 'mode', mode: 'minecraft', target: 16000, seedOffset: 47 },
        { key: 'dungeon', kind: 'mode', mode: 'dungeon', target: 14000, seedOffset: 61 },
    ];
}

function launchNextMatrixBenchmark() {
    const next = benchmarkMatrix.queue.shift();
    if (!next) {
        const payload = {
            generatedAt: new Date().toISOString(),
            path: cameraPath.recordedPath || null,
            runs: benchmarkMatrix.runs,
        };
        downloadText(`benchmark_matrix_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
        benchmarkMatrix.active = false;
        benchmarkMatrix.current = null;
        hud.showToast('Benchmark matrix complete. JSON exported.');
        return;
    }

    benchmarkMatrix.current = next;
    const seed = Number(state.sceneSeed) + Number(next.seedOffset || 0);
    state.sceneSeed = seed;

    if (next.kind === 'complexity') {
        generateComplexityPreset(next.level);
    } else {
        state.mode = next.mode;
        state.objectCount = next.target;
        regenerateObjects();
    }

    const technique = benchmarkRunner.start(cameraPath.recordedPath, {
        label: `matrix-${next.key}`,
        sceneLabel: state.environmentLabel,
        sceneSeed: seed,
        warmupFrames: 30,
    });
    cameraPath.startReplay(cameraPath.recordedPath, {
        loop: false,
        smoothing: state.cameraPathSmoothing,
        constantSpeed: state.cameraPathConstantSpeed,
    });
    hud.showToast(`Matrix run ${next.key} started (${technique.label}).`);
}

function startBenchmarkMatrix() {
    if (benchmarkRunner.active) {
        hud.showToast('Wait for current benchmark to finish first.');
        return;
    }
    if (!cameraPath.recordedPath?.samples?.length) {
        hud.showToast('Record or import a camera path before benchmark.');
        return;
    }
    benchmarkMatrix.active = true;
    benchmarkMatrix.runs = [];
    benchmarkMatrix.queue = buildBenchmarkMatrixQueue();
    launchNextMatrixBenchmark();
}

function updateCameraMovement() {
    if (keys['KeyW']) {
        camera.position[0] += Math.sin(camera.yaw) * speed;
        camera.position[2] -= Math.cos(camera.yaw) * speed;
    }
    if (keys['KeyS']) {
        camera.position[0] -= Math.sin(camera.yaw) * speed;
        camera.position[2] += Math.cos(camera.yaw) * speed;
    }
    if (keys['KeyA']) {
        camera.position[0] -= Math.cos(camera.yaw) * speed;
        camera.position[2] -= Math.sin(camera.yaw) * speed;
    }
    if (keys['KeyD']) {
        camera.position[0] += Math.cos(camera.yaw) * speed;
        camera.position[2] += Math.sin(camera.yaw) * speed;
    }
    if (keys['KeyQ'] || keys['Space']) camera.position[1] += speed;
    if (keys['KeyE'] || keys['ShiftLeft']) camera.position[1] -= speed;
    if (keys['ArrowLeft']) camera.yaw -= turnSpeed;
    if (keys['ArrowRight']) camera.yaw += turnSpeed;
    if (keys['ArrowUp']) camera.pitch += turnSpeed;
    if (keys['ArrowDown']) camera.pitch -= turnSpeed;
    camera.updateViewMatrix();
}

function drawBBox(center, scale, color, scaleVec = [1, 1, 1]) {
    bbShader.use();
    gl.uniformMatrix4fv(bbUniformLocations.view, false, camera.viewMatrix);
    gl.uniformMatrix4fv(bbUniformLocations.projection, false, camera.projectionMatrix);
    gl.uniform4f(bbUniformLocations.offset, center[0], center[1], center[2], 0);
    gl.uniform1f(bbUniformLocations.scale, scale);
    gl.uniform3fv(bbUniformLocations.scaleVec, scaleVec);
    gl.uniform3fv(bbUniformLocations.color, color);

    const positionLocation = gl.getAttribLocation(bbShader.program, 'aVertexPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, bbox.vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bbox.indexBuffer);
    gl.drawElements(gl.LINES, bbox.count, gl.UNSIGNED_SHORT, 0);
}

function drawCullingDebug(decisions) {
    if (!state.showBBox && !state.showHeatmap) return;

    let drawn = 0;
    for (const decision of decisions.values()) {
        if (drawn > 700) break;
        const bounds = decision.object.bounds || getGeneratedBounds(decision.object);
        let color = decision.visible ? [0.1, 1.0, 0.3] : [1.0, 0.1, 0.1];
        if (state.showHeatmap) {
            if (decision.reason === 'frustum') color = [0.1, 0.55, 1.0];
            else if (decision.reason === 'occlusion') color = [1.0, 0.1, 0.15];
            else if (decision.reason === 'lod') color = [1.0, 0.7, 0.05];
            else if (decision.reason === 'temporal') color = [0.3, 1.0, 0.95];
            else if (decision.reason === 'predicted') color = [0.7, 0.5, 1.0];
        }
        drawBBox(bounds.center, 1.02, color, bounds.halfSize);
        drawn++;
    }
}

function effectiveState() {
    const benchmarkOverrides = benchmarkRunner.active && benchmarkRunner.currentTechnique
        ? { ...benchmarkRunner.currentTechnique.state, useAdaptiveBudget: false, showHeatmap: false, showOcclusionGrid: false }
        : {};
    return { ...state, ...benchmarkOverrides };
}

function renderGeneratedDecision(decision, runtimeState) {
    const object = decision.object;
    const mesh = object.mesh || (object.geometry ? getMeshForType(object.geometry) : activeMesh);
    if (!mesh) return 0;

    shader.use();
    gl.uniformMatrix4fv(uniformLocations.view, false, camera.viewMatrix);
    gl.uniformMatrix4fv(uniformLocations.projection, false, camera.projectionMatrix);
    gl.uniform3fv(uniformLocations.lightDir, lightDirection);
    gl.uniform4f(uniformLocations.offset, object.pos[0], object.pos[1], object.pos[2], 0.0);
    gl.uniform3f(uniformLocations.baseColor, object.color[0], object.color[1], object.color[2]);
    gl.uniform1f(uniformLocations.scale, decision.lod.scale);
    gl.uniform3fv(uniformLocations.scaleVec, object.scaleVec || [object.scale || 1, object.scale || 1, object.scale || 1]);
    gl.uniform1f(uniformLocations.rotationY, object.rotationY || 0);
    gl.uniform1i(uniformLocations.useVertexColor, mesh.hasColors ? 1 : 0);
    gl.uniform1f(uniformLocations.lodLevel, runtimeState.showLODColor ? decision.lod.level : 0);

    mesh.draw(shader.program);
    return mesh.indexCount || 0;
}

function renderGeneratedInstanced(decisions, runtimeState) {
    if (!instancingAvailable || decisions.length === 0) {
        return { renderedObjects: 0, vertexCount: 0 };
    }

    const batches = new Map();
    const fallback = [];
    for (const decision of decisions) {
        const object = decision.object;
        const mesh = object.mesh || (object.geometry ? getMeshForType(object.geometry) : activeMesh);
        if (!mesh || mesh.hasColors) {
            fallback.push(decision);
            continue;
        }
        const key = object.geometry || 'cube';
        if (!batches.has(key)) batches.set(key, { mesh, decisions: [] });
        batches.get(key).decisions.push(decision);
    }

    let renderedObjects = 0;
    let vertexCount = 0;
    instancedShader.use();
    gl.uniformMatrix4fv(instancedUniformLocations.view, false, camera.viewMatrix);
    gl.uniformMatrix4fv(instancedUniformLocations.projection, false, camera.projectionMatrix);
    gl.uniform3fv(instancedUniformLocations.lightDir, lightDirection);
    gl.uniform1i(instancedUniformLocations.showLodColor, runtimeState.showLODColor ? 1 : 0);

    const positionLocation = gl.getAttribLocation(instancedShader.program, 'aVertexPosition');
    const normalLocation = gl.getAttribLocation(instancedShader.program, 'aVertexNormal');
    const offsetLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceOffset');
    const colorLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceColor');
    const scaleVecLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceScaleVec');
    const scaleLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceScale');
    const rotationLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceRotationY');
    const lodLocation = gl.getAttribLocation(instancedShader.program, 'aInstanceLod');

    for (const batch of batches.values()) {
        const mesh = batch.mesh;
        const items = batch.decisions;
        if (!mesh?.vertexBuffer || !mesh?.normalBuffer || !mesh?.indexBuffer) {
            fallback.push(...items);
            continue;
        }

        const count = items.length;
        if (count <= 0) continue;

        const offsets = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const scaleVecs = new Float32Array(count * 3);
        const scales = new Float32Array(count);
        const rotations = new Float32Array(count);
        const lodLevels = new Float32Array(count);

        for (let index = 0; index < count; index++) {
            const decision = items[index];
            const object = decision.object;
            const offset = index * 3;
            offsets[offset] = object.pos[0];
            offsets[offset + 1] = object.pos[1];
            offsets[offset + 2] = object.pos[2];
            colors[offset] = object.color?.[0] ?? 0.2;
            colors[offset + 1] = object.color?.[1] ?? 0.8;
            colors[offset + 2] = object.color?.[2] ?? 1.0;
            const scaleVec = object.scaleVec || [object.scale || 1, object.scale || 1, object.scale || 1];
            scaleVecs[offset] = scaleVec[0];
            scaleVecs[offset + 1] = scaleVec[1];
            scaleVecs[offset + 2] = scaleVec[2];
            scales[index] = decision.lod?.scale ?? 1;
            rotations[index] = object.rotationY || 0;
            lodLevels[index] = decision.lod?.level ?? 0;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);
        setAttribDivisor(positionLocation, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLocation);
        setAttribDivisor(normalLocation, 0);

        const bindInstanceAttr = (buffer, location, size, values) => {
            if (location < 0) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, values, gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(location);
            setAttribDivisor(location, 1);
        };

        bindInstanceAttr(instancedBuffers.offset, offsetLocation, 3, offsets);
        bindInstanceAttr(instancedBuffers.color, colorLocation, 3, colors);
        bindInstanceAttr(instancedBuffers.scaleVec, scaleVecLocation, 3, scaleVecs);
        bindInstanceAttr(instancedBuffers.scale, scaleLocation, 1, scales);
        bindInstanceAttr(instancedBuffers.rotation, rotationLocation, 1, rotations);
        bindInstanceAttr(instancedBuffers.lod, lodLocation, 1, lodLevels);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        drawElementsInstanced(mesh.indexCount || 0, getMeshIndexType(mesh), count);

        renderedObjects += count;
        vertexCount += (mesh.indexCount || 0) * count;
        perfMonitor.countDrawCall((mesh.indexCount || 0) * count);
    }

    for (const location of [offsetLocation, colorLocation, scaleVecLocation, scaleLocation, rotationLocation, lodLocation]) {
        setAttribDivisor(location, 0);
    }

    for (const decision of fallback) {
        const renderedVertices = renderGeneratedDecision(decision, runtimeState);
        perfMonitor.countDrawCall(renderedVertices);
        renderedObjects++;
        vertexCount += renderedVertices;
    }

    return { renderedObjects, vertexCount };
}

function drawOcclusionOverlay(runtimeState) {
    if (!runtimeState.showOcclusionGrid || !occlusionOverlayCtx) {
        occlusionOverlay.style.display = 'none';
        return;
    }

    const snapshot = occlusion.getDepthGridSnapshot?.();
    if (!snapshot?.values?.length) {
        occlusionOverlay.style.display = 'none';
        return;
    }
    occlusionOverlay.style.display = 'block';

    const resolution = snapshot.resolution || 1;
    const values = snapshot.values;
    const cellW = occlusionOverlay.width / resolution;
    const cellH = occlusionOverlay.height / resolution;
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (const value of values) {
        if (!Number.isFinite(value)) continue;
        if (value < minDepth) minDepth = value;
        if (value > maxDepth) maxDepth = value;
    }
    const span = Math.max(0.0001, maxDepth - minDepth);

    occlusionOverlayCtx.clearRect(0, 0, occlusionOverlay.width, occlusionOverlay.height);
    for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
            const depth = values[y * resolution + x];
            if (!Number.isFinite(depth)) {
                occlusionOverlayCtx.fillStyle = 'rgba(25,30,40,0.7)';
            } else {
                const t = Math.max(0, Math.min(1, (depth - minDepth) / span));
                const r = Math.round(30 + (1 - t) * 225);
                const g = Math.round(40 + t * 170);
                const b = Math.round(80 + t * 120);
                occlusionOverlayCtx.fillStyle = `rgba(${r},${g},${b},0.92)`;
            }
            occlusionOverlayCtx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
        }
    }
}

function importPath(raw) {
    try {
        cameraPath.importJSON(raw);
        state.cameraPathSmoothing = !!cameraPath.replaySmoothing;
        state.cameraPathConstantSpeed = !!cameraPath.replayConstantSpeed;
        researchPanel.syncState(state);
        hud.showToast('Camera path imported.');
    } catch (error) {
        hud.showToast(error.message);
    }
}

function updateResearchPanel(runtimeState, stageStats) {
    const pathStatus = cameraPath.getStatus();
    const benchmarkStatus = benchmarkRunner.getStatus();
    researchPanel.updateStatus({
        path: `${pathStatus.mode} | ${pathStatus.sampleCount} samples | ${pathStatus.smoothing ? 'smooth' : 'raw'} | ${pathStatus.constantSpeed ? 'const-speed' : 'time-native'}`,
        benchmark: benchmarkStatus.active
            ? `${benchmarkStatus.currentTechnique || 'running'} (${benchmarkStatus.warmupFrames || 0} warmup)`
            : benchmarkStatus.completed
                ? 'completed'
                : 'idle',
        quality: runtimeState.useAdaptiveBudget
            ? `${state.qualityProfile} @ ${state.budgetAverageFps || perfMonitor.snapshot.fps} fps`
            : state.qualityProfile,
        stageMs: `${stageStats?.spatialMs || 0} / ${stageStats?.predictiveMs || 0} / ${stageStats?.occlusionMs || 0} / ${stageStats?.lodMs || 0}`,
        hybrid: `${stageStats?.reusedVisibility || 0} / ${stageStats?.predictedVisible || 0}`,
    });
}

window.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    keys[event.code] = true;
    event.preventDefault();
});

window.addEventListener('keyup', event => {
    keys[event.code] = false;
});

document.addEventListener('mousedown', event => {
    if (event.defaultPrevented) return;
    if (event.target.closest('#left-panel,#left-panel-toggle,#perf-overlay,#import-panel,#ip-toggle,#research-panel,#research-toggle')) return;
    if (modelImporter.shouldHandlePointer(event)) return;
    mouseDown = true;
    renderer.canvas.requestPointerLock?.();
});

document.addEventListener('mouseup', () => {
    mouseDown = false;
    document.exitPointerLock?.();
});

document.addEventListener('mousemove', event => {
    if (!mouseDown || cameraPath.replaying) return;
    camera.yaw += event.movementX * (turnSpeed * 0.07);
    camera.pitch -= event.movementY * (turnSpeed * 0.07);
});

mountUI({
    state,
    leftPanel,
    researchPanel,
    importPanel,
    chartPanel,
    modelImporter,
    cameraPath,
    showToast: message => hud.showToast(message),
    syncImportedRegistry,
    syncSceneUI,
    setGeometryType,
    regenerateObjects,
    generateComplexityPreset,
    clearGeneratedScene,
    exportPerformanceJSON,
    exportCameraPath,
    importPath,
    startBenchmark,
    startBenchmarkMatrix,
    exportBenchmark,
    setCameraSpeed: value => {
        speed = value;
    },
    setCameraTurnSpeed: value => {
        turnSpeed = value;
    },
});

regenerateObjects();
syncSceneUI();
hud.updateStats({ fps: 0, drawn: 0, total: 0, stageStats: null });

function gameLoop() {
    perfMonitor.beginFrame();
    renderer.render();

    const now = performance.now();
    const replaying = cameraPath.update(camera, now);
    if (!replaying) updateCameraMovement();
    if (cameraPath.recording) cameraPath.sample(camera, now);

    shader.use();
    gl.uniformMatrix4fv(uniformLocations.view, false, camera.viewMatrix);
    gl.uniformMatrix4fv(uniformLocations.projection, false, camera.projectionMatrix);
    gl.uniform3fv(uniformLocations.lightDir, lightDirection);

    frustum.update(camera.projectionMatrix, camera.viewMatrix);

    adaptiveQuality.enabled = state.useAdaptiveBudget;
    adaptiveQuality.update(perfMonitor.snapshot, state, occlusion, lod);

    const runtimeState = effectiveState();
    if (!runtimeState.useAdaptiveBudget) {
        occlusion.setResolution?.(runtimeState.occlusionResolution || 24);
    }
    lod.nearThreshold = Math.max(20, Number(runtimeState.lodNear) || lod.nearThreshold);
    lod.midThreshold = Math.max(lod.nearThreshold + 20, Number(runtimeState.lodMid) || lod.midThreshold);
    lod.farThreshold = Math.max(lod.midThreshold + 20, Number(runtimeState.lodFar) || lod.farThreshold);
    lod.transitionBand = Math.max(4, Number(runtimeState.lodTransitionBand) || lod.transitionBand);
    lod.enabled = runtimeState.useLOD;
    occlusion.enabled = runtimeState.useOcclusion;

    const importedObjects = modelImporter.getCullingObjects?.() || [];
    const pipelineResult = hybridPipeline.evaluate({
        generatedObjects,
        importedObjects,
        state: runtimeState,
        camera,
    });
    state.lastStageStats = pipelineResult.stageStats;

    let drawnObjects = 0;
    let vertexCount = 0;
    const visibleImportedIds = new Set();
    const generatedVisible = [];

    for (const decision of pipelineResult.visible) {
        if (decision.object.cullingSource === 'imported') {
            visibleImportedIds.add(decision.object.id);
            drawnObjects++;
            vertexCount += Math.round((decision.object.bounds?.radius || 1) * 120);
            continue;
        }
        generatedVisible.push(decision);
    }

    const generatedRender = runtimeState.useInstancing && instancingAvailable
        ? renderGeneratedInstanced(generatedVisible, runtimeState)
        : (() => {
            let renderedObjects = 0;
            let vertices = 0;
            for (const decision of generatedVisible) {
                const renderedVertices = renderGeneratedDecision(decision, runtimeState);
                perfMonitor.countDrawCall(renderedVertices);
                vertices += renderedVertices;
                renderedObjects++;
            }
            return { renderedObjects, vertexCount: vertices };
        })();
    drawnObjects += generatedRender.renderedObjects;
    vertexCount += generatedRender.vertexCount;

    drawCullingDebug(pipelineResult.decisions);
    drawOcclusionOverlay(runtimeState);
    modelImporter.syncCamera(camera, visibleImportedIds);

    const totalSceneObjects = getSceneObjectCount();
    const totalCulled = Math.max(0, totalSceneObjects - drawnObjects);

    perfMonitor.endFrame(drawnObjects, totalCulled, totalSceneObjects, {
        vertexCount,
        octreeDepth: pipelineResult.stageStats.octreeDepth,
        stageStats: pipelineResult.stageStats,
    });

    if (benchmarkRunner.active && benchmarkRunner.currentTechnique) {
        benchmarkRunner.captureFrame({
            elapsedMs: Math.round(now - benchmarkRunner.currentTechnique.startedAt),
            fps: perfMonitor.snapshot.fps,
            cpuFrameMs: perfMonitor.snapshot.cpuFrameMs,
            gpuFrameMs: perfMonitor.snapshot.gpuFrameMs,
            drawCalls: perfMonitor.snapshot.drawCalls,
            vertexCount: perfMonitor.snapshot.vertexCount,
            rendered: drawnObjects,
            culled: totalCulled,
            cullEfficiency: perfMonitor.snapshot.cullEff,
            octreeDepth: perfMonitor.snapshot.octreeDepth,
            stageSpatialMs: pipelineResult.stageStats.spatialMs,
            stagePredictiveMs: pipelineResult.stageStats.predictiveMs,
            stageOcclusionMs: pipelineResult.stageStats.occlusionMs,
            stageLodMs: pipelineResult.stageStats.lodMs,
            reusedVisibility: pipelineResult.stageStats.reusedVisibility,
            predictedVisible: pipelineResult.stageStats.predictedVisible,
        });
    }

    if (benchmarkRunner.active && benchmarkRunner.currentTechnique && !cameraPath.replaying) {
        const finished = benchmarkRunner.finalizeCurrentTechnique();
        const nextTechnique = benchmarkRunner.nextTechnique();
        if (nextTechnique) {
            cameraPath.startReplay(cameraPath.recordedPath, {
                loop: false,
                smoothing: state.cameraPathSmoothing,
                constantSpeed: state.cameraPathConstantSpeed,
            });
            hud.showToast(`Benchmark switching to ${nextTechnique.label}. Avg FPS previous: ${finished.avgFps}`);
        } else {
            if (benchmarkMatrix.active) {
                benchmarkMatrix.runs.push({
                    scene: benchmarkMatrix.current,
                    result: JSON.parse(benchmarkRunner.exportJSON()),
                });
                launchNextMatrixBenchmark();
            } else {
                hud.showToast('Benchmark completed. Export JSON or CSV from Research Lab.');
            }
        }
    }

    hud.updateStats({
        fps: perfMonitor.snapshot.fps,
        drawn: drawnObjects,
        total: totalSceneObjects,
        stageStats: pipelineResult.stageStats,
    });
    chartPanel.update(perfMonitor, runtimeState);
    leftPanel.updatePerf(perfMonitor.snapshot, camera, drawnObjects, totalCulled, totalSceneObjects);
    updateResearchPanel(runtimeState, pipelineResult.stageStats);

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
