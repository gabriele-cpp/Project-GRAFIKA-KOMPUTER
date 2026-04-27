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
import { generateComplexityScene } from './objects/scene-generator.js';
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

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.style.opacity = '0';
    }, 3500);
}

const renderer = new Renderer('gameCanvas');
const gl = renderer.gl;
const shader = new Shader(gl, vertexShaderCode, fragmentShaderCode);
const bbShader = new Shader(gl, bbVertexCode, bbFragmentCode);
const bbox = createBBoxMesh(gl);

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
    useAdaptiveBudget: false,
    showBBox: false,
    showLODColor: false,
    showHeatmap: false,
    objectCount: 500,
    mode: 'random',
    paletteIdx: 0,
    complexity: 'medium',
    environmentLabel: 'Random',
    environmentGroups: {},
    qualityProfile: 'high',
    budgetAverageFps: 0,
    shadowQuality: 0.85,
    postProcessScale: 0.9,
    dynamicLodDistanceScale: 1.0,
    lastStageStats: null,
};

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

function getMeshForType(type = 'cube') {
    const meshType = GEOMETRY_TYPES.includes(type) ? type : 'cube';
    if (!meshCache.has(meshType)) {
        meshCache.set(meshType, meshType === 'cube' ? new Mesh(gl) : createGeometry(gl, meshType));
    }
    return meshCache.get(meshType);
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
    const total = getSceneObjectCount();
    const objectCountDisplay = document.getElementById('obj-count-display');
    if (objectCountDisplay) objectCountDisplay.textContent = `${total.toLocaleString()} objects`;
    importPanel.setObjectRegistry?.([...sceneRegistry.imported.values()], sceneRegistry.importedSelectedId);
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
        objects = generateClustered(state.objectCount, 500, 12);
        state.environmentLabel = 'Clustered';
    } else {
        objects = generateObjects(state.objectCount, 500, state.paletteIdx);
        state.environmentLabel = 'Random';
    }
    state.environmentGroups = { [state.environmentLabel]: objects.length };
    rebuildScene(objects);
}

function generateComplexityPreset(level = 'medium') {
    const scene = generateComplexityScene(level, state.paletteIdx);
    state.complexity = level;
    state.objectCount = scene.objects.length;
    state.environmentLabel = scene.label;
    state.environmentGroups = scene.groups;
    rebuildScene(scene.objects);
    leftPanel.syncObjCount?.(state.objectCount);
    const slider = document.getElementById('obj-slider');
    if (slider) slider.value = state.objectCount;
    showToast(`${scene.label} generated for benchmark experiments.`);
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
        geometry: object.geometry === 'plane' ? 'plane' : type,
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
                qualityProfile: state.qualityProfile,
            },
            renderer: renderer.capabilities,
        }, null, 2),
        'application/json'
    );
    showToast('Performance snapshot exported as JSON.');
}

function exportCameraPath() {
    if (!cameraPath.recordedPath?.samples?.length) {
        showToast('Record a camera path first.');
        return;
    }
    downloadText(`camera_path_${Date.now()}.json`, cameraPath.exportJSON(), 'application/json');
}

function exportBenchmark(format = 'json') {
    if (!benchmarkRunner.results.length && !benchmarkRunner.samples.length) {
        showToast('Run benchmark first.');
        return;
    }
    if (format === 'csv') {
        downloadText(`benchmark_${Date.now()}.csv`, benchmarkRunner.exportCSV(), 'text/csv');
    } else {
        downloadText(`benchmark_${Date.now()}.json`, benchmarkRunner.exportJSON(), 'application/json');
    }
}

function startBenchmark() {
    if (!cameraPath.recordedPath?.samples?.length) {
        showToast('Record or import a camera path before benchmark.');
        return;
    }
    const technique = benchmarkRunner.start(cameraPath.recordedPath, {
        label: 'camera-benchmark',
        sceneLabel: state.environmentLabel,
    });
    cameraPath.startReplay(cameraPath.recordedPath, { loop: false });
    showToast(`Benchmark started with ${technique.label}.`);
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

function updateStatsPanel(drawn, total, stageStats) {
    const culled = Math.max(0, total - drawn);
    const efficiency = total > 0 ? Math.round((culled / total) * 100) : 0;
    const fps = perfMonitor.snapshot.fps;

    document.getElementById('stat-fps').textContent = fps;
    document.getElementById('stat-rendered').textContent = drawn.toLocaleString();
    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-culled').textContent = culled.toLocaleString();
    document.getElementById('stat-eff').textContent = `${efficiency}%`;
    document.getElementById('stat-cF').textContent = (stageStats?.frustumCulled || 0).toLocaleString();
    document.getElementById('stat-cO').textContent = (stageStats?.occlusionCulled || 0).toLocaleString();
    document.getElementById('stat-cL').textContent = (stageStats?.lodCulled || 0).toLocaleString();

    const fpsElement = document.getElementById('stat-fps');
    fpsElement.style.color = fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444';
}

function effectiveState() {
    const benchmarkOverrides = benchmarkRunner.active && benchmarkRunner.currentTechnique
        ? { ...benchmarkRunner.currentTechnique.state, useAdaptiveBudget: false, showHeatmap: false }
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

function importPath(raw) {
    try {
        cameraPath.importJSON(raw);
        showToast('Camera path imported.');
    } catch (error) {
        showToast(error.message);
    }
}

function updateResearchPanel(runtimeState, stageStats) {
    const pathStatus = cameraPath.getStatus();
    const benchmarkStatus = benchmarkRunner.getStatus();
    researchPanel.updateStatus({
        path: `${pathStatus.mode} | ${pathStatus.sampleCount} samples`,
        benchmark: benchmarkStatus.active
            ? benchmarkStatus.currentTechnique || 'running'
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

modelImporter.onLoad = (filename, meta, autoScale) => {
    importPanel.setModelLoaded(filename, meta);
    if (autoScale != null) importPanel.syncScale(autoScale);
    showToast(`"${filename}" loaded into scene.`);
};
modelImporter.onError = message => showToast(message);
modelImporter.onProgress = percent => importPanel.setProgress(percent);
modelImporter.onRegistryChange = (objects, event) => {
    syncImportedRegistry(objects, event?.selectedId ?? null);
    syncSceneUI();
};

window.addEventListener('DOMContentLoaded', () => {
    const bindToggle = (id, key) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.checked = state[key];
        element.addEventListener('change', event => {
            state[key] = event.target.checked;
        });
    };

    bindToggle('toggleFrustum', 'useFrustum');
    bindToggle('toggleOctree', 'useOctree');
    bindToggle('toggleOcclusion', 'useOcclusion');
    bindToggle('toggleLOD', 'useLOD');
    bindToggle('toggleBBox', 'showBBox');
    bindToggle('toggleLODColor', 'showLODColor');

    const slider = document.getElementById('obj-slider');
    if (slider) {
        slider.value = state.objectCount;
        let debounceTimer = null;
        slider.addEventListener('input', event => {
            state.objectCount = parseInt(event.target.value, 10) || 0;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => regenerateObjects(), 350);
        });
        slider.addEventListener('change', event => {
            state.objectCount = parseInt(event.target.value, 10) || 0;
            regenerateObjects();
        });
    }

    document.getElementById('btn-generate')?.addEventListener('click', regenerateObjects);
    document.getElementById('sel-mode')?.addEventListener('change', event => {
        state.mode = event.target.value;
    });
    document.getElementById('sel-palette')?.addEventListener('change', event => {
        state.paletteIdx = parseInt(event.target.value, 10) || 0;
    });
    document.getElementById('btn-perf')?.addEventListener('click', () => chartPanel.toggle());

    leftPanel.mount({
        onObjType: type => {
            setGeometryType(type);
            showToast(`Geometry changed to ${type.toUpperCase()}.`);
        },
        onObjCount: count => {
            state.objectCount = count;
            regenerateObjects();
        },
        onMode: mode => {
            state.mode = mode;
        },
        onPalette: index => {
            state.paletteIdx = index;
        },
        onGenerate: regenerateObjects,
        onGenerateEnvironment: () => generateComplexityPreset(state.complexity),
        onClearGeneratedScene: clearGeneratedScene,
        onStateChange: (key, value) => {
            state[key] = value;
            const rightMap = {
                useFrustum: 'toggleFrustum',
                useOctree: 'toggleOctree',
                useOcclusion: 'toggleOcclusion',
                useLOD: 'toggleLOD',
                showBBox: 'toggleBBox',
                showLODColor: 'toggleLODColor',
            };
            const element = document.getElementById(rightMap[key]);
            if (element) element.checked = value;
            researchPanel.syncState(state);
        },
        onExportJSON: exportPerformanceJSON,
        onChartPanel: () => chartPanel.toggle(),
        onCameraSpeed: value => {
            speed = value;
        },
        onCameraTurnSpeed: value => {
            turnSpeed = value;
        },
    });

    researchPanel.mount({
        onToggleState: (key, value) => {
            state[key] = value;
            researchPanel.syncState(state);
        },
        onGenerateComplexity: level => generateComplexityPreset(level),
        onRecord: () => {
            cameraPath.startRecording(`${state.environmentLabel}-${Date.now()}`);
            showToast('Camera path recording started.');
        },
        onStopRecord: () => {
            cameraPath.stopRecording();
            showToast('Camera path recording stopped.');
        },
        onReplay: () => {
            if (!cameraPath.startReplay()) showToast('No camera path available.');
        },
        onExportPath: exportCameraPath,
        onImportPath: importPath,
        onStartBenchmark: startBenchmark,
        onExportBenchmark: exportBenchmark,
    });
    researchPanel.syncState(state);

    importPanel.mount({
        onUpload: files => modelImporter.loadFiles(files),
        onRemove: () => {
            modelImporter.remove();
            if (modelImporter.objects.length === 0) importPanel.reset();
            showToast('Imported model removed.');
        },
        onInstanceCount: count => modelImporter.setInstanceCount(count),
        onScale: ({ x, y, z }) => modelImporter.setScale(x, y, z),
        onSelectObject: id => modelImporter.select(id),
        onDuplicateObject: async id => {
            const newId = await modelImporter.duplicate(id);
            if (newId) showToast('Imported object duplicated.');
        },
        onRemoveObject: id => {
            modelImporter.remove(id);
            if (modelImporter.objects.length === 0) importPanel.reset();
            showToast('Imported object removed.');
        },
        onError: message => showToast(message),
    });

    regenerateObjects();
    syncSceneUI();
    updateStatsPanel(0, 0, null);
});

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

    for (const decision of pipelineResult.visible) {
        if (decision.object.cullingSource === 'imported') {
            visibleImportedIds.add(decision.object.id);
            drawnObjects++;
            vertexCount += Math.round((decision.object.bounds?.radius || 1) * 120);
            continue;
        }

        const renderedVertices = renderGeneratedDecision(decision, runtimeState);
        perfMonitor.countDrawCall(renderedVertices);
        vertexCount += renderedVertices;
        drawnObjects++;
    }

    drawCullingDebug(pipelineResult.decisions);
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
            frameIndex: benchmarkRunner.currentTechnique.frames.length,
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
            cameraPath.startReplay(cameraPath.recordedPath, { loop: false });
            showToast(`Benchmark switching to ${nextTechnique.label}. Avg FPS previous: ${finished.avgFps}`);
        } else {
            showToast('Benchmark completed. Export JSON or CSV from Research Lab.');
        }
    }

    updateStatsPanel(drawnObjects, totalSceneObjects, pipelineResult.stageStats);
    chartPanel.update(perfMonitor, runtimeState);
    leftPanel.updatePerf(perfMonitor.snapshot, camera, drawnObjects, totalCulled, totalSceneObjects);
    updateResearchPanel(runtimeState, pipelineResult.stageStats);

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
