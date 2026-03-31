import { Renderer }         from './engine/renderer.js';
import { Shader }           from './engine/shader.js';
import { Camera }           from './engine/camera.js';
import { Mesh }             from './engine/mesh.js';

// Culling modules (asli + baru)
import { Frustum }          from './culling/frustum.js';
import { Octree }           from './culling/octree.js';      // [BARU]
import { LOD }              from './culling/lod.js';         // [BARU]
import { OcclusionCuller }  from './culling/occlusion.js';   // [BARU]

import { generateObjects, generateClustered } from './objects/objects.js'; // [BARU]
import { PerformanceMonitor }               from './engine/performance.js'; // [BARU]
import { ChartPanel }                       from './ui/chart-panel.js';     // [BARU]
import { LeftPanel }                        from './ui/left-panel.js';      // [BARU — Fitur 1-6]
import { createGeometry, GeometryMesh, GEOMETRY_TYPES }  from './engine/geometry.js';
import { ModelImporter }                    from './engine/model-importer.js'; // [BARU] right panel loader
import { ImportPanel }                      from './ui/import-panel.js';       // [BARU] right sidebar

// SHADER 
const vertexShaderCode = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;

    uniform vec4 uOffset;
    uniform float uScale;           // [BARU] LOD scale
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec3 vNormal;

    void main() {
        // [BARU] terapkan LOD scale ke setiap vertex
        vec4 scaledPos = vec4(aVertexPosition.xyz * uScale, 1.0);
        vec4 finalPosition = scaledPos + uOffset;
        gl_Position = uProjectionMatrix * uViewMatrix * finalPosition;
        vNormal = aVertexNormal;
    }
`;

const fragmentShaderCode = `
    precision mediump float;
    varying vec3 vNormal;
    uniform vec3 uLightDirection;
    uniform vec3 uBaseColor;
    uniform float uLodLevel;        // [BARU] level LOD untuk visualisasi debug

    void main() {
        vec3 normal   = normalize(vNormal);
        vec3 lightDir = normalize(uLightDirection);
        float diffuse = max(dot(normal, lightDir), 0.0);

        vec3 baseNeon  = uBaseColor * 0.9;
        vec3 highlight = uBaseColor * diffuse * 0.6;
        vec3 finalColor = baseNeon + highlight;

        // [BARU] Debug mode: warnai berdasarkan LOD level
        // Level 0=hijau cerah, 1=kuning, 2=merah — hanya jika uLodLevel > 0
        if (uLodLevel > 0.5) {
            if (uLodLevel < 1.5) finalColor = mix(finalColor, vec3(1.0,1.0,0.0), 0.4);
            else                 finalColor = mix(finalColor, vec3(1.0,0.2,0.0), 0.5);
        }

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// SHADER BOUNDING BOX (wire frame untuk debug culling)
const bbVertexCode = `
    attribute vec4 aVertexPosition;
    uniform vec4 uOffset;
    uniform float uScale;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main() {
        vec4 scaledPos = vec4(aVertexPosition.xyz * uScale, 1.0);
        gl_Position = uProjectionMatrix * uViewMatrix * (scaledPos + uOffset);
    }
`;
const bbFragmentCode = `
    precision mediump float;
    uniform vec3 uBBoxColor;
    void main() { gl_FragColor = vec4(uBBoxColor, 1.0); }
`;

// BOUNDING BOX WIRE MESH (12 garis = 24 vertex)
function createBBoxMesh(gl) {
    // 8 corner cube ±1
    const v = new Float32Array([
        -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
        -1,-1, 1, 1,-1, 1, 1,1, 1, -1,1, 1
    ]);
    const idx = new Uint16Array([
        0,1,1,2,2,3,3,0, // bottom
        4,5,5,6,6,7,7,4, // top
        0,4,1,5,2,6,3,7  // sides
    ]);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vb, ib, count: idx.length };
}

// SETUP
const renderer = new Renderer('gameCanvas');
const gl       = renderer.gl;

const shader   = new Shader(gl, vertexShaderCode,  fragmentShaderCode);
const bbShader = new Shader(gl, bbVertexCode,       bbFragmentCode);
// cube removed — replaced by activeMesh (see geometry system below)
const bbox     = createBBoxMesh(gl);

const aspect   = renderer.canvas.width / renderer.canvas.height;
const camera   = new Camera(Math.PI / 4, aspect, 0.1, 2000.0);

// Culling systems
const frustum  = new Frustum();
const octree   = new Octree(600, 5, 20);   // [BARU] world size 600, max depth 5
const lod      = new LOD();                 // [BARU]
const occlusion = new OcclusionCuller();    // [BARU]

// Uniform locations 
const viewLoc       = gl.getUniformLocation(shader.program, 'uViewMatrix');
const projLoc       = gl.getUniformLocation(shader.program, 'uProjectionMatrix');
const offsetLoc     = gl.getUniformLocation(shader.program, 'uOffset');
const scaleLoc      = gl.getUniformLocation(shader.program, 'uScale');         // [BARU]
const lightDirLoc   = gl.getUniformLocation(shader.program, 'uLightDirection');
const baseColorLoc  = gl.getUniformLocation(shader.program, 'uBaseColor');
const lodLevelLoc   = gl.getUniformLocation(shader.program, 'uLodLevel');      // [BARU]

// BBox uniform locations 
const bbViewLoc    = gl.getUniformLocation(bbShader.program, 'uViewMatrix');
const bbProjLoc    = gl.getUniformLocation(bbShader.program, 'uProjectionMatrix');
const bbOffsetLoc  = gl.getUniformLocation(bbShader.program, 'uOffset');
const bbScaleLoc   = gl.getUniformLocation(bbShader.program, 'uScale');
const bbColorLoc   = gl.getUniformLocation(bbShader.program, 'uBBoxColor');

const lightDirection = [0.8, 1.0, 0.5];

// PERFORMANCE MONITOR + CHART PANEL 
const perfMonitor = new PerformanceMonitor(gl);
const chartPanel  = new ChartPanel();
const leftPanel   = new LeftPanel();   

// GEOMETRY SYSTEM 
// activeMesh adalah referensi ke mesh yang sedang dipakai render.
// Mengganti activeMesh tidak mengubah pipeline — hanya pointer.
let activeMesh = new Mesh(gl); 
let currentGeoType = 'cube';

function setGeometryType(type) {
    currentGeoType = type;
    if (type === 'none') {
        activeMesh = null;  // null = skip draw call (scene kosong)
    } else if (type === 'cube') {
        activeMesh = new Mesh(gl); // pakai Mesh asli untuk cube
    } else {
        activeMesh = createGeometry(gl, type);
    }
}

// IMPORT PANEL + MODEL IMPORTER [BARU]
const importPanel   = new ImportPanel();
const modelImporter = new ModelImporter();

let importedMesh      = null;
let importedInstances = [];
let importedScaleX    = 1.0;
let importedScaleY    = 1.0;
let importedScaleZ    = 1.0;

modelImporter.onLoad = (filename, meta) => {
    importPanel.setModelLoaded(filename, meta);
    showToast(`"${filename}" berhasil dimuat!`);
};
modelImporter.onError    = (msg) => { showToast(`Error: ${msg}`); };
modelImporter.onProgress = (pct) => { importPanel.setProgress(pct); };
modelImporter.onGeometryReady = (geo, positions, sx, sy, sz) => {
    importedMesh      = geo.indices.length > 0
        ? new GeometryMesh(gl, geo.vertices, geo.normals, geo.indices)
        : null;
    importedInstances = positions;
    importedScaleX = sx; importedScaleY = sy; importedScaleZ = sz;
};

// EXPORT JSON HELPER 
function downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perf_export_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    a.click();
}

function exportPerformanceJSON() {
    const snap = perfMonitor.snapshot;
    const data = {
        timestamp:       new Date().toISOString(),
        fps:             snap.fps,
        frameTime:       snap.cpuFrameMs,
        gpuFrameTime:    snap.gpuFrameMs,
        heapMemoryMB:    snap.heapMB,
        drawCalls:       snap.drawCalls,
        totalObjects:    cubeData.length,
        renderedObjects: snap.rendered,
        culledObjects:   snap.culledTotal,
        cullingEfficiency: snap.cullEff + '%',
        cameraPosition:  [...camera.position],
        activeMethods: {
            frustumCulling:   state.useFrustum,
            octreeSpatial:    state.useOctree,
            occlusionCulling: state.useOcclusion,
            levelOfDetail:    state.useLOD,
        },
        geometryType: currentGeoType,
        sceneMode:    state.mode,
    };
    downloadJSON(data);
    showToast('Performance data berhasil diekspor sebagai JSON.');
}


// STATE KONTROL (toggle dari UI)
const state = {
    useFrustum:     true,
    useOctree:      true,   // [BARU]
    useOcclusion:   false,  // [BARU]
    useLOD:         false,  // [BARU]
    showBBox:       false,  // [BARU]
    showLODColor:   false,  // [BARU]
    objectCount:    500,
    mode:           'random', // 'random' | 'clustered'
    paletteIdx:     0,
};

// GENERATE OBJECTS & BUILD OCTREE 
let cubeData = [];
let octreeCandidates = []; // Hasil query frustum via octree

function regenerateObjects() {
    const count = state.objectCount;
    if (state.mode === 'clustered') {
        cubeData = generateClustered(count, 500, 12);
    } else {
        cubeData = generateObjects(count, 500, state.paletteIdx);
    }
    // Rebuild octree dengan semua objek baru
    octree.rebuild(cubeData);
    updateUI_ObjectCount(count);
}

regenerateObjects(); // Initial population

// KEYBOARD CAMERA CONTROL 
const keys = {};
window.addEventListener('keydown', e => {
    // Jangan intercept keyboard saat user sedang mengetik di input/textarea/select
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup',   e => { keys[e.code] = false; });

const speed     = 1.5;
const turnSpeed = 0.03;

// Mouse look — listen on document so Three.js overlay canvas doesn't block it
let mouseDown = false;
let lastMouseX = 0, lastMouseY = 0;
document.addEventListener('mousedown', e => {
    // Jangan trigger camera drag saat klik di UI panels
    if (e.target.closest('#left-panel'))       return;
    if (e.target.closest('#left-panel-toggle')) return;
    if (e.target.closest('#perf-overlay'))      return;
    if (e.target.closest('#import-panel'))      return;
    if (e.target.closest('#ip-toggle'))         return;
    mouseDown = true;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    renderer.canvas.requestPointerLock();
});
document.addEventListener('mouseup', () => { mouseDown = false; document.exitPointerLock(); });
document.addEventListener('mousemove', e => {
    if (!mouseDown) return;
    camera.yaw   += e.movementX * 0.002;
    camera.pitch -= e.movementY * 0.002;
});

function updateCameraMovement() {
    if (keys['KeyW']) { camera.position[0] += Math.sin(camera.yaw)*speed; camera.position[2] -= Math.cos(camera.yaw)*speed; }
    if (keys['KeyS']) { camera.position[0] -= Math.sin(camera.yaw)*speed; camera.position[2] += Math.cos(camera.yaw)*speed; }
    if (keys['KeyA']) { camera.position[0] -= Math.cos(camera.yaw)*speed; camera.position[2] -= Math.sin(camera.yaw)*speed; }
    if (keys['KeyD']) { camera.position[0] += Math.cos(camera.yaw)*speed; camera.position[2] += Math.sin(camera.yaw)*speed; }
    if (keys['KeyQ'] || keys['Space'])  camera.position[1] += speed;
    if (keys['KeyE'] || keys['ShiftLeft']) camera.position[1] -= speed;
    if (keys['ArrowLeft'])  camera.yaw -= turnSpeed;
    if (keys['ArrowRight']) camera.yaw += turnSpeed;
    if (keys['ArrowUp'])    camera.pitch += turnSpeed;
    if (keys['ArrowDown'])  camera.pitch -= turnSpeed;
    camera.updateViewMatrix();
}

// DRAW BOUNDING BOX (wire frame) 
function drawBBox(pos, scale, color) {
    bbShader.use();
    gl.uniformMatrix4fv(bbViewLoc, false, camera.viewMatrix);
    gl.uniformMatrix4fv(bbProjLoc, false, camera.projectionMatrix);
    gl.uniform4f(bbOffsetLoc, pos[0], pos[1], pos[2], 0);
    gl.uniform1f(bbScaleLoc, scale * 1.05); // sedikit lebih besar dari objek
    gl.uniform3fv(bbColorLoc, color);

    const posLoc = gl.getAttribLocation(bbShader.program, 'aVertexPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, bbox.vb);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bbox.ib);
    gl.drawElements(gl.LINES, bbox.count, gl.UNSIGNED_SHORT, 0);
}

// FPS & STATS
let lastTime   = performance.now();
let frameCount = 0;
let currentFPS = 0;

// GAME LOOP  
function gameLoop() {
    perfMonitor.beginFrame(); 
    renderer.render();
    shader.use();

    updateCameraMovement();

    // Update uniform yang sama dengan kode asli
    gl.uniformMatrix4fv(viewLoc,     false, camera.viewMatrix);
    gl.uniformMatrix4fv(projLoc,     false, camera.projectionMatrix);
    gl.uniform3fv(lightDirLoc, lightDirection);

    // Update frustum planes
    frustum.update(camera.projectionMatrix, camera.viewMatrix);

    // HYBRID SPATIAL-OCCLUSION CULLING PIPELINE 

    let candidates = cubeData; // Default: semua objek

    // STEP 1: Spatial pruning via Octree (O(log n) vs O(n))
    if (state.useOctree && state.useFrustum) {
        octree.queryFrustum(frustum, octreeCandidates);
        candidates = octreeCandidates;
    } else if (state.useFrustum && !state.useOctree) {
        // Frustum culling manual (seperti kode asli)
        candidates = cubeData.filter(d => frustum.containsSphere(d.pos[0], d.pos[1], d.pos[2], 1.73));
    }

    // STEP 2: Per-candidate LOD + Occlusion test
    let drawnObjects = 0;
    let culledFrustum  = cubeData.length - candidates.length;
    let culledOcclusion = 0;
    let culledLOD       = 0;

    // Untuk occlusion: kumpulkan occluder (objek terdekat yang sudah dirender)
    const occluders = [];
    // Sort by distance (dekat dulu) untuk occlusion check yang efisien
    if (state.useOcclusion) {
        candidates.sort((a, b) => {
            const da = Math.hypot(a.pos[0]-camera.position[0], a.pos[1]-camera.position[1], a.pos[2]-camera.position[2]);
            const db = Math.hypot(b.pos[0]-camera.position[0], b.pos[1]-camera.position[1], b.pos[2]-camera.position[2]);
            return da - db;
        });
    }

    for (const data of candidates) {
        const dist = Math.hypot(
            data.pos[0]-camera.position[0],
            data.pos[1]-camera.position[1],
            data.pos[2]-camera.position[2]
        );

        // STEP 2a: Occlusion culling [BARU]
        occlusion.enabled = state.useOcclusion;
        if (!occlusion.shouldRender(data.pos, dist, camera.position, camera.forward, occluders)) {
            culledOcclusion++;
            continue;
        }

        // STEP 2b: LOD [BARU]
        lod.enabled = state.useLOD;
        const lodResult = lod.getLevel(dist);
        if (!lodResult.shouldRender) {
            culledLOD++;
            continue;
        }

        // STEP 3: RENDER (sama seperti kode asli, + scale & lodLevel uniform)
        // Skip jika type = 'none' (activeMesh null)
        if (!activeMesh) { drawnObjects++; continue; }

        shader.use();
        gl.uniform4f(offsetLoc,  data.pos[0], data.pos[1], data.pos[2], 0.0);
        gl.uniform3f(baseColorLoc, data.color[0], data.color[1], data.color[2]);
        gl.uniform1f(scaleLoc, data.scale * lodResult.scale);    // [BARU]
        gl.uniform1f(lodLevelLoc, state.showLODColor ? lodResult.level : 0); // [BARU]

        activeMesh.draw(shader.program);  // pakai activeMesh (bisa ganti geometri)
        perfMonitor.countDrawCall(); 
        drawnObjects++;

        // Tambahkan ke occluder list (hanya objek dekat saja)
        if (state.useOcclusion && dist < 50 && occluders.length < 30) {
            occluders.push({ pos: data.pos, dist });
        }

        // Render bounding box jika debug mode aktif
        if (state.showBBox && drawnObjects <= 500) { // limit 500 agar tidak lambat
            const bboxColor = lodResult.level === 0 ? [0,1,0] :
                              lodResult.level === 1 ? [1,1,0] : [1,0.3,0];
            drawBBox(data.pos, data.scale * lodResult.scale, bboxColor);
        }
    }

    // FPS COUNTER 
    const totalCulled = cubeData.length - drawnObjects;
    perfMonitor.endFrame(drawnObjects, totalCulled, cubeData.length);

    // ── RENDER IMPORTED INSTANCES (from right panel) ──
    // Terpisah dari cubeData pipeline, tidak kena culling (jumlah max 100)
    if (importedMesh && importedInstances.length > 0) {
        shader.use();
        for (const pos of importedInstances) {
            gl.uniform4f(offsetLoc, pos[0], pos[1], pos[2], 0.0);
            gl.uniform3f(baseColorLoc, 0.0, 0.78, 1.0); // cyan — bisa dikustomisasi
            gl.uniform1f(scaleLoc, importedScaleX);
            gl.uniform1f(lodLevelLoc, 0);
            importedMesh.draw(shader.program);
        }
    }

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 500) {
        currentFPS = Math.round(frameCount / ((now - lastTime) / 1000));
        frameCount = 0;
        lastTime   = now;
        updateStatsPanel(drawnObjects, culledFrustum, culledOcclusion, culledLOD);
        chartPanel.update(perfMonitor, state);
        leftPanel.updatePerf(perfMonitor.snapshot, camera, drawnObjects, cubeData.length - drawnObjects, cubeData.length);
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// UI PANEL  — Modern floating control panel
function updateStatsPanel(drawn, culledF, culledO, culledL) {
    const total   = cubeData.length;
    const culled  = total - drawn;
    const efficiency = total > 0 ? Math.round((culled / total) * 100) : 0;

    document.getElementById('stat-fps').textContent     = currentFPS;
    document.getElementById('stat-rendered').textContent = drawn.toLocaleString();
    document.getElementById('stat-total').textContent    = total.toLocaleString();
    document.getElementById('stat-culled').textContent   = culled.toLocaleString();
    document.getElementById('stat-eff').textContent      = efficiency + '%';
    document.getElementById('stat-cF').textContent       = culledF.toLocaleString();
    document.getElementById('stat-cO').textContent       = culledO.toLocaleString();
    document.getElementById('stat-cL').textContent       = culledL.toLocaleString();

    // Color FPS
    const fpsEl = document.getElementById('stat-fps');
    fpsEl.style.color = currentFPS >= 50 ? '#00ff88' : currentFPS >= 30 ? '#ffcc00' : '#ff4444';
}

function updateUI_ObjectCount(count) {
    const el = document.getElementById('obj-count-display');
    if (el) el.textContent = count.toLocaleString() + ' objects';
}

// Bind checkbox toggles
function bindToggle(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = state[key];
    el.addEventListener('change', e => {
        state[key] = e.target.checked;
        if (key === 'useLOD') lod.enabled = e.target.checked;
        if (key === 'useOcclusion') occlusion.enabled = e.target.checked;
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // ── RIGHT panel toggles (kept for backward compat) ──
    bindToggle('toggleFrustum',   'useFrustum');
    bindToggle('toggleOctree',    'useOctree');
    bindToggle('toggleOcclusion', 'useOcclusion');
    bindToggle('toggleLOD',       'useLOD');
    bindToggle('toggleBBox',      'showBBox');
    bindToggle('toggleLODColor',  'showLODColor');

    // ── RIGHT panel slider ──
    const slider = document.getElementById('obj-slider');
    if (slider) {
        slider.value = state.objectCount;
        let debounceTimer = null;
        slider.addEventListener('input', e => {
            state.objectCount = parseInt(e.target.value);
            document.getElementById('obj-count-display').textContent =
                state.objectCount.toLocaleString() + ' objects';
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => regenerateObjects(), 400);
        });
        slider.addEventListener('change', () => { clearTimeout(debounceTimer); regenerateObjects(); });
    }

    document.getElementById('btn-generate')?.addEventListener('click', () => regenerateObjects());
    document.getElementById('sel-mode')?.addEventListener('change', e => { state.mode = e.target.value; });
    document.getElementById('sel-palette')?.addEventListener('change', e => { state.paletteIdx = parseInt(e.target.value); });
    document.getElementById('btn-perf')?.addEventListener('click', () => chartPanel.toggle());

    // MOUNT LEFT PANEL — Fitur 1, 2, 3, 4, 5, 6
    leftPanel.mount({
        // Fitur 2: Object type changed
        onObjType: (type) => {
            setGeometryType(type);
            showToast(`Geometry changed to: ${type.toUpperCase()}`);
        },



        // Scene control
        onObjCount: (count) => {
            state.objectCount = count;
            regenerateObjects();
            // Sync hidden right panel slider
            const rs = document.getElementById('obj-slider');
            if (rs) rs.value = count;
        },
        onMode:    (mode)  => { state.mode = mode; },
        onPalette: (idx)   => { state.paletteIdx = idx; },
        onGenerate: ()     => { regenerateObjects(); },

        // Culling toggles from left panel
        onStateChange: (key, val) => {
            state[key] = val;
            if (key === 'useLOD')       lod.enabled       = val;
            if (key === 'useOcclusion') occlusion.enabled = val;
            // Also sync right panel checkboxes
            const rightId = key.replace(/([A-Z])/g, m => m).replace('use','toggle').replace('show','toggle');
            // Map key → right panel checkbox id
            const rightMap = {
                useFrustum:   'toggleFrustum',
                useOctree:    'toggleOctree',
                useOcclusion: 'toggleOcclusion',
                useLOD:       'toggleLOD',
                showBBox:     'toggleBBox',
                showLODColor: 'toggleLODColor',
            };
            const rEl = document.getElementById(rightMap[key]);
            if (rEl) rEl.checked = val;
        },

        // Fitur 5: Export JSON
        onExportJSON: () => exportPerformanceJSON(),

        // Performance chart panel
        onChartPanel: () => chartPanel.toggle(),
    });

    leftPanel.syncState(state);
    leftPanel.syncObjCount(state.objectCount);

    // Mount Import Panel (right sidebar)
    importPanel.mount({
        onUpload: (file) => {
            modelImporter.loadFile(file);
        },
        onRemove: () => {
            modelImporter.remove();
            importedMesh      = null;
            importedInstances = [];
            showToast('Model dihapus dari scene.');
        },
        onInstanceCount: (n) => {
            modelImporter.setInstanceCount(n);
        },
        onScale: ({ x, y, z }) => {
            modelImporter.setScale(x, y, z);
        },
        onError: (msg) => { showToast(msg); },
    });

    // Exclude import panel from camera drag
    document.addEventListener('mousedown', e => {
        if (e.target.closest('#import-panel') || e.target.closest('#ip-toggle')) {
            // handled inside importPanel / modelImporter
        }
    }, true);

    // Update awal
    updateStatsPanel(0, 0, 0, 0);
    updateUI_ObjectCount(state.objectCount);
});

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => t.style.opacity = '0', 4000);
}
