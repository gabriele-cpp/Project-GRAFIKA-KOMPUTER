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
const cube     = new Mesh(gl);
const bbox     = createBBoxMesh(gl);

const aspect   = renderer.canvas.width / renderer.canvas.height;
const camera   = new Camera(Math.PI / 4, aspect, 0.1, 2000.0);

// Culling systems
const frustum  = new Frustum();
const octree   = new Octree(600, 5, 20);   
const lod      = new LOD();                
const occlusion = new OcclusionCuller();    

// Uniform locations (asli)
const viewLoc       = gl.getUniformLocation(shader.program, 'uViewMatrix');
const projLoc       = gl.getUniformLocation(shader.program, 'uProjectionMatrix');
const offsetLoc     = gl.getUniformLocation(shader.program, 'uOffset');
const scaleLoc      = gl.getUniformLocation(shader.program, 'uScale');        
const lightDirLoc   = gl.getUniformLocation(shader.program, 'uLightDirection');
const baseColorLoc  = gl.getUniformLocation(shader.program, 'uBaseColor');
const lodLevelLoc   = gl.getUniformLocation(shader.program, 'uLodLevel');      

// BBox uniform locations [BARU]
const bbViewLoc    = gl.getUniformLocation(bbShader.program, 'uViewMatrix');
const bbProjLoc    = gl.getUniformLocation(bbShader.program, 'uProjectionMatrix');
const bbOffsetLoc  = gl.getUniformLocation(bbShader.program, 'uOffset');
const bbScaleLoc   = gl.getUniformLocation(bbShader.program, 'uScale');
const bbColorLoc   = gl.getUniformLocation(bbShader.program, 'uBBoxColor');

const lightDirection = [0.8, 1.0, 0.5];

// PERFORMANCE MONITOR + CHART PANEL 
const perfMonitor = new PerformanceMonitor(gl);
const chartPanel  = new ChartPanel();

// STATE KONTROL (toggle dari UI)
const state = {
    useFrustum:     true,
    useOctree:      true,  
    useOcclusion:   false, 
    useLOD:         false,  
    showBBox:       false,  
    showLODColor:   false, 
    objectCount:    5000,
    mode:           'random', // 'random' | 'clustered'
    paletteIdx:     0,
};

// GENERATE OBJECTS & BUILD OCTREE 
let cubeData = [];
let octreeCandidates = []; 

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


// KEYBOARD CAMERA CONTROL (dipertahankan dari kode asli)
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

const speed     = 1.5;
const turnSpeed = 0.03;

// [BARU] Mouse look
let mouseDown = false;
let lastMouseX = 0, lastMouseY = 0;
renderer.canvas.addEventListener('mousedown', e => { mouseDown = true; lastMouseX = e.clientX; lastMouseY = e.clientY; renderer.canvas.requestPointerLock(); });
renderer.canvas.addEventListener('mouseup',   () => { mouseDown = false; document.exitPointerLock(); });
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

// GAME LOOP  — dimodifikasi untuk pipeline baru
function gameLoop() {
    perfMonitor.beginFrame(); // [BARU] mulai pengukuran frame
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
        shader.use();
        gl.uniform4f(offsetLoc,  data.pos[0], data.pos[1], data.pos[2], 0.0);
        gl.uniform3f(baseColorLoc, data.color[0], data.color[1], data.color[2]);
        gl.uniform1f(scaleLoc, data.scale * lodResult.scale);    // [BARU]
        gl.uniform1f(lodLevelLoc, state.showLODColor ? lodResult.level : 0); // [BARU]

        cube.draw(shader.program);
        perfMonitor.countDrawCall(); // [BARU]
        drawnObjects++;

        // Tambahkan ke occluder list (hanya objek dekat saja)
        if (state.useOcclusion && dist < 50 && occluders.length < 30) {
            occluders.push({ pos: data.pos, dist });
        }

        // [BARU] Render bounding box jika debug mode aktif
        if (state.showBBox && drawnObjects <= 500) { // limit 500 agar tidak lambat
            const bboxColor = lodResult.level === 0 ? [0,1,0] :
                              lodResult.level === 1 ? [1,1,0] : [1,0.3,0];
            drawBBox(data.pos, data.scale * lodResult.scale, bboxColor);
        }
    }

    // FPS COUNTER 
    const totalCulled = cubeData.length - drawnObjects;
    perfMonitor.endFrame(drawnObjects, totalCulled, cubeData.length); 

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 500) { // Update setiap 0.5 detik untuk angka lebih stabil
        currentFPS = Math.round(frameCount / ((now - lastTime) / 1000));
        frameCount = 0;
        lastTime   = now;
        updateStatsPanel(drawnObjects, culledFrustum, culledOcclusion, culledLOD);
        chartPanel.update(perfMonitor, state); // [BARU] update chart data
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// UI PANEL [BARU] — Modern floating control panel
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
    bindToggle('toggleFrustum',   'useFrustum');
    bindToggle('toggleOctree',    'useOctree');
    bindToggle('toggleOcclusion', 'useOcclusion');
    bindToggle('toggleLOD',       'useLOD');
    bindToggle('toggleBBox',      'showBBox');
    bindToggle('toggleLODColor',  'showLODColor');

    // Slider jumlah objek — regenerate dengan debounce 400ms
    const slider = document.getElementById('obj-slider');
    if (slider) {
        slider.value = state.objectCount;

        let debounceTimer = null;

        slider.addEventListener('input', e => {
            // Update nilai & label langsung (real-time feedback)
            state.objectCount = parseInt(e.target.value);
            document.getElementById('obj-count-display').textContent =
                state.objectCount.toLocaleString() + ' objects';

            // Tunggu 400ms setelah slider berhenti bergerak, baru regenerate
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                regenerateObjects();
            }, 400);
        });

        // Backup: juga trigger saat mouse/touch dilepas (untuk kepastian)
        slider.addEventListener('change', () => {
            clearTimeout(debounceTimer);
            regenerateObjects();
        });
    }

    // Tombol Generate (tetap tersedia untuk force regenerate)
    document.getElementById('btn-generate')?.addEventListener('click', () => {
        regenerateObjects();
    });

    // Mode selector
    document.getElementById('sel-mode')?.addEventListener('change', e => {
        state.mode = e.target.value;
    });

    // Palette selector
    document.getElementById('sel-palette')?.addEventListener('change', e => {
        state.paletteIdx = parseInt(e.target.value);
    });

    // GLTF Upload placeholder [BARU]
    document.getElementById('btn-upload')?.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input')?.addEventListener('change', handleFileUpload);

    // Performance Dashboard button
    document.getElementById('btn-perf')?.addEventListener('click', () => {
        chartPanel.toggle();
    });

    // Update awal
    updateStatsPanel(0, 0, 0, 0);
    updateUI_ObjectCount(state.objectCount);
});

// FILE UPLOAD HANDLER (GLTF/OBJ placeholder) [BARU]
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    showToast(`File "${file.name}" diterima (format: ${ext.toUpperCase()}). GLTF loader memerlukan Three.js. Untuk penelitian ini, objek custom dapat diintegrasikan via Three.js GLTFLoader.`);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => t.style.opacity = '0', 4000);
}
