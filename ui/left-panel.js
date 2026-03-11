const PANEL_HTML = `
<div id="left-panel-toggle" title="Toggle Feature Panel">
  <span id="toggle-icon">◀</span>
</div>

<aside id="left-panel">
  <div class="lp-header">
    <span class="lp-logo">⬡</span>
    <span class="lp-title">FEATURE PANEL</span>
  </div>

  <!-- ════ OBJECT TYPE ════ -->
  <section class="lp-section" id="sec-objtype">
    <div class="lp-sec-header" data-target="body-objtype">
      <span class="lp-sec-icon">◈</span> Object Type
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body" id="body-objtype">
      <div class="obj-grid" id="obj-type-grid">
        <!-- Buttons injected by JS -->
      </div>
    </div>
  </section>

  <!-- ════ CUSTOM MODEL ════ -->
  <section class="lp-section" id="sec-model">
    <div class="lp-sec-header" data-target="body-model">
      <span class="lp-sec-icon">⬡</span> Custom Model
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body" id="body-model">

      <div class="upload-zone" id="upload-zone">
        <div class="upload-icon">↑</div>
        <div class="upload-label">Drop GLTF / GLB / OBJ</div>
        <div class="upload-sub">or click to browse</div>
      </div>
      <input type="file" id="lp-file-input" accept=".gltf,.glb,.obj" style="display:none">

      <div id="model-controls" style="display:none">
        <div class="lp-label">Loaded: <span id="model-name" style="color:var(--lp-accent)">—</span></div>

        <div class="lp-field">
          <label class="lp-label">Scale</label>
          <div class="lp-slider-row">
            <input type="range"  id="ctrl-scale" min="0.1" max="5" step="0.1" value="1">
            <input type="number" id="num-scale"  class="lp-num-input" min="0.1" max="5" step="0.1" value="1">
          </div>
        </div>
        <div class="lp-field">
          <label class="lp-label">Rotate X</label>
          <div class="lp-slider-row">
            <input type="range"  id="ctrl-rotX" min="-180" max="180" step="1" value="0">
            <input type="number" id="num-rotX"  class="lp-num-input" min="-180" max="180" step="1" value="0">
          </div>
        </div>
        <div class="lp-field">
          <label class="lp-label">Rotate Y</label>
          <div class="lp-slider-row">
            <input type="range"  id="ctrl-rotY" min="-180" max="180" step="1" value="0">
            <input type="number" id="num-rotY"  class="lp-num-input" min="-180" max="180" step="1" value="0">
          </div>
        </div>
        <button class="lp-btn lp-btn-danger" id="btn-delete-model">✕ Delete Model</button>
      </div>
    </div>
  </section>

  <!-- ════ SCENE CONTROL ════ -->
  <section class="lp-section" id="sec-scene">
    <div class="lp-sec-header" data-target="body-scene">
      <span class="lp-sec-icon">⊞</span> Scene Control
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body" id="body-scene">

      <div class="lp-field">
        <label class="lp-label">Objects</label>
        <div class="lp-slider-row">
          <input type="range" id="lp-obj-slider" min="1" max="50000" step="1" value="500">
          <input type="number" id="lp-obj-num" class="lp-num-input" min="1" max="50000" step="1" value="500">
        </div>
      </div>

      <div class="lp-field">
        <label class="lp-label">Distribution</label>
        <select id="lp-sel-mode">
          <option value="random">Random</option>
          <option value="clustered">Clustered</option>
        </select>
      </div>

      <div class="lp-field">
        <label class="lp-label">Color Palette</label>
        <select id="lp-sel-palette">
          <option value="0">Cyber / Neon</option>
          <option value="1">Warm</option>
          <option value="2">Cool</option>
        </select>
      </div>

      <button class="lp-btn lp-btn-primary" id="lp-btn-generate">⟳ Generate Scene</button>
    </div>
  </section>

  <!-- ════ CULLING METHODS ════ -->
  <section class="lp-section">
    <div class="lp-sec-header" data-target="body-culling">
      <span class="lp-sec-icon">✂</span> Culling Methods
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body" id="body-culling">
      <label class="lp-toggle-row">
        <span>Frustum Culling <span class="tag-base">BASE</span></span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleFrustum" checked><span class="lp-track"></span></div>
      </label>
      <label class="lp-toggle-row">
        <span>Octree Spatial <span class="tag-new">NEW</span></span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleOctree" checked><span class="lp-track"></span></div>
      </label>
      <label class="lp-toggle-row">
        <span>Occlusion Culling <span class="tag-new">NEW</span></span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleOcclusion"><span class="lp-track"></span></div>
      </label>
      <label class="lp-toggle-row">
        <span>Level of Detail <span class="tag-new">NEW</span></span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleLOD"><span class="lp-track"></span></div>
      </label>
    </div>
  </section>

  <!-- ════ DEBUG VISUALIZATION ════ -->
  <section class="lp-section">
    <div class="lp-sec-header" data-target="body-debug">
      <span class="lp-sec-icon">⬡</span> Debug Visualization
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body" id="body-debug">
      <label class="lp-toggle-row">
        <span>Bounding Box</span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleBBox"><span class="lp-track"></span></div>
      </label>
      <label class="lp-toggle-row">
        <span>LOD Color Mode</span>
        <div class="lp-switch"><input type="checkbox" id="lp-toggleLODColor"><span class="lp-track"></span></div>
      </label>
    </div>
  </section>

  <!-- ════ PERFORMANCE ════ -->
  <section class="lp-section" id="sec-perf">
    <div class="lp-sec-header" data-target="body-perf">
      <span class="lp-sec-icon">⚡</span> Performance
      <span class="lp-chevron">▾</span>
    </div>
    <div class="lp-sec-body open" id="body-perf">

      <div class="perf-grid">
        <div class="perf-tile">
          <span class="pt-val" id="lp-fps">0</span>
          <span class="pt-lbl">FPS</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-framems">0</span>
          <span class="pt-lbl">Frame ms</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-rendered">0</span>
          <span class="pt-lbl">Rendered</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-culled">0</span>
          <span class="pt-lbl">Culled</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-total">0</span>
          <span class="pt-lbl">Total Objs</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-drawcalls">0</span>
          <span class="pt-lbl">Draw Calls</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-heap">—</span>
          <span class="pt-lbl">Heap MB</span>
        </div>
        <div class="perf-tile">
          <span class="pt-val" id="lp-gpu">—</span>
          <span class="pt-lbl">GPU ms</span>
        </div>
      </div>

      <div class="lp-label lp-campos" id="lp-campos">CAM: 0, 0, 0</div>

      <button class="lp-btn" id="lp-btn-chartpanel">📊 Open Charts</button>
      <button class="lp-btn lp-btn-export" id="lp-btn-export">⬇ Export JSON</button>
    </div>
  </section>

</aside>
`;

// STYLES  (injected once into <head>)
const PANEL_CSS = `
:root {
  --lp-w: 270px;
  --lp-bg: rgba(4, 6, 20, 0.97);
  --lp-border: rgba(0, 200, 255, 0.14);
  --lp-accent: #00c8ff;
  --lp-accent2: #7b2fff;
  --lp-green: #00ff88;
  --lp-yellow: #ffe033;
  --lp-red: #ff4455;
  --lp-text: #b8ccd8;
  --lp-dim: #445566;
  --lp-mono: 'Share Tech Mono', monospace;
  --lp-ui: 'Exo 2', sans-serif;
}

/* ── Toggle button ── */
#left-panel-toggle {
  position: fixed;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 120;
  width: 22px;
  height: 56px;
  background: rgba(0,200,255,0.12);
  border: 1px solid var(--lp-border);
  border-left: none;
  border-radius: 0 6px 6px 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: left 0.35s cubic-bezier(.4,0,.2,1), background 0.2s;
  font-size: 0.7rem;
  color: var(--lp-accent);
  user-select: none;
  backdrop-filter: blur(8px);
}
#left-panel-toggle:hover { background: rgba(0,200,255,0.25); }
#left-panel-toggle.open { left: var(--lp-w); }

/* ── Sidebar ── */
#left-panel {
  position: fixed;
  top: 0; left: 0;
  width: var(--lp-w);
  height: 100vh;
  z-index: 110;
  background: var(--lp-bg);
  border-right: 1px solid var(--lp-border);
  backdrop-filter: blur(18px);
  overflow-y: auto;
  overflow-x: hidden;
  transform: translateX(calc(-1 * var(--lp-w)));
  transition: transform 0.35s cubic-bezier(.4,0,.2,1);
  font-family: var(--lp-ui);
  color: var(--lp-text);
  scrollbar-width: thin;
  scrollbar-color: rgba(0,200,255,0.25) transparent;
}
#left-panel.open { transform: translateX(0); }
#left-panel::-webkit-scrollbar { width: 3px; }
#left-panel::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.3); border-radius: 3px; }

/* ── Header ── */
.lp-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--lp-border);
  position: sticky; top: 0; z-index: 2;
  background: var(--lp-bg);
}
.lp-logo { font-size: 1.1rem; color: var(--lp-accent); }
.lp-title {
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--lp-accent);
}

/* ── Sections ── */
.lp-section { border-bottom: 1px solid rgba(0,200,255,0.07); }

.lp-sec-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.72rem; font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--lp-text);
  user-select: none;
  transition: background 0.15s;
}
.lp-sec-header:hover { background: rgba(0,200,255,0.05); }
.lp-sec-icon { color: var(--lp-accent); font-size: 0.65rem; }
.lp-chevron { margin-left: auto; font-size: 0.6rem; transition: transform 0.2s; color: var(--lp-dim); }
.lp-sec-header.collapsed .lp-chevron { transform: rotate(-90deg); }

.lp-sec-body {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.3s ease;
  padding: 0 14px;
}
.lp-sec-body.open {
  max-height: 600px;
  padding: 4px 14px 14px;
}

/* ── Object type grid ── */
.obj-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px 0 8px;
}
.obj-btn {
  padding: 8px 4px;
  background: rgba(0,200,255,0.05);
  border: 1px solid var(--lp-border);
  border-radius: 5px;
  color: var(--lp-text);
  font-family: var(--lp-mono);
  font-size: 0.62rem;
  cursor: pointer;
  text-align: center;
  transition: 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.obj-btn:hover { background: rgba(0,200,255,0.12); border-color: rgba(0,200,255,0.3); }
.obj-btn.active {
  background: rgba(0,200,255,0.18);
  border-color: var(--lp-accent);
  color: var(--lp-accent);
  box-shadow: 0 0 10px rgba(0,200,255,0.18);
}
.obj-icon { font-size: 1.1rem; }

/* ── Upload zone ── */
.upload-zone {
  border: 1px dashed rgba(0,200,255,0.3);
  border-radius: 8px;
  padding: 16px 8px;
  text-align: center;
  cursor: pointer;
  transition: 0.2s;
  margin-bottom: 10px;
}
.upload-zone:hover, .upload-zone.drag-over {
  border-color: var(--lp-accent);
  background: rgba(0,200,255,0.06);
}
.upload-icon { font-size: 1.4rem; color: var(--lp-accent); margin-bottom: 4px; }
.upload-label { font-size: 0.7rem; color: var(--lp-text); }
.upload-sub { font-size: 0.58rem; color: var(--lp-dim); margin-top: 2px; }

/* ── Fields ── */
.lp-field { margin-bottom: 10px; }
.lp-label {
  display: flex; justify-content: space-between;
  font-size: 0.65rem; color: var(--lp-dim);
  margin-bottom: 5px; letter-spacing: 0.05em;
}

select {
  width: 100%;
  background: rgba(0,200,255,0.05);
  border: 1px solid var(--lp-border);
  border-radius: 4px;
  color: var(--lp-text);
  padding: 5px 8px;
  font-size: 0.68rem;
  font-family: var(--lp-ui);
  outline: none;
  cursor: pointer;
}

input[type=range] {
  -webkit-appearance: none;
  width: 100%; height: 3px;
  background: rgba(0,200,255,0.15);
  border-radius: 3px; outline: none;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--lp-accent);
  box-shadow: 0 0 5px var(--lp-accent);
  cursor: pointer;
}

/* Slider + number input side by side */
.lp-slider-row {
  display: flex; align-items: center; gap: 8px;
}
.lp-slider-row input[type=range] { flex: 1; }

.lp-num-input {
  width: 60px; flex-shrink: 0;
  background: rgba(0,200,255,0.06);
  border: 1px solid var(--lp-border);
  border-radius: 4px;
  color: var(--lp-accent);
  font-family: var(--lp-mono);
  font-size: 0.72rem;
  padding: 3px 6px;
  text-align: right;
  outline: none;
  -moz-appearance: textfield;
}
.lp-num-input::-webkit-outer-spin-button,
.lp-num-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.lp-num-input:focus {
  border-color: var(--lp-accent);
  box-shadow: 0 0 6px rgba(0,200,255,0.2);
}

/* ── Buttons ── */
.lp-btn {
  display: block; width: 100%;
  padding: 8px;
  border: 1px solid var(--lp-border);
  border-radius: 5px;
  background: rgba(0,200,255,0.06);
  color: var(--lp-accent);
  font-family: var(--lp-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-align: center;
  transition: 0.15s;
  margin-bottom: 6px;
}
.lp-btn:last-child { margin-bottom: 0; }
.lp-btn:hover { background: rgba(0,200,255,0.15); }

.lp-btn-primary {
  background: linear-gradient(135deg, rgba(0,200,255,0.15), rgba(123,47,255,0.15));
  border-color: rgba(123,47,255,0.4);
  color: #ddd0ff;
}
.lp-btn-export {
  background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,200,255,0.1));
  border-color: rgba(0,255,136,0.3);
  color: var(--lp-green);
}
.lp-btn-danger {
  background: rgba(255,68,85,0.08);
  border-color: rgba(255,68,85,0.3);
  color: var(--lp-red);
  margin-top: 8px;
}
.lp-btn-danger:hover { background: rgba(255,68,85,0.2); }

/* ── Toggle switches ── */
.lp-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.68rem; margin-bottom: 8px; cursor: pointer;
}
.lp-switch { position: relative; width: 34px; height: 18px; flex-shrink: 0; }
.lp-switch input { opacity: 0; width: 0; height: 0; }
.lp-track {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.07);
  border: 1px solid var(--lp-border);
  border-radius: 18px; cursor: pointer; transition: 0.2s;
}
.lp-track::after {
  content: ''; position: absolute;
  top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--lp-dim); transition: 0.22s;
}
.lp-switch input:checked + .lp-track {
  background: rgba(0,200,255,0.2);
  border-color: var(--lp-accent);
  box-shadow: 0 0 6px rgba(0,200,255,0.3);
}
.lp-switch input:checked + .lp-track::after {
  transform: translateX(16px);
  background: var(--lp-accent);
}

/* ── Performance grid ── */
.perf-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 5px; margin-bottom: 10px;
}
.perf-tile {
  background: rgba(0,200,255,0.04);
  border: 1px solid var(--lp-border);
  border-radius: 5px;
  padding: 7px 8px;
  text-align: center;
}
.pt-val {
  display: block;
  font-family: var(--lp-mono);
  font-size: 0.95rem;
  color: var(--lp-accent);
  line-height: 1.1;
}
.pt-lbl {
  display: block;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lp-dim);
  margin-top: 2px;
}

.lp-campos {
  font-family: var(--lp-mono);
  font-size: 0.6rem;
  color: var(--lp-dim);
  margin-bottom: 10px;
  text-align: center;
}

/* ── Tags ── */
.tag-new {
  font-size: 0.48rem; background: var(--lp-accent2);
  color: white; padding: 1px 4px; border-radius: 3px; margin-left: 4px;
}
.tag-base {
  font-size: 0.48rem; background: rgba(0,200,255,0.2);
  color: var(--lp-accent); padding: 1px 4px; border-radius: 3px; margin-left: 4px;
}
`;


// Object type definitions with emoji icons
const OBJ_TYPES = [
    { id: 'cube',     label: 'Cube',     icon: '⬛' },
    { id: 'sphere',   label: 'Sphere',   icon: '⚪' },
    { id: 'cone',     label: 'Cone',     icon: '△' },
    { id: 'cylinder', label: 'Cylinder', icon: '⬤' },
    { id: 'plane',    label: 'Plane',    icon: '▬' },
    { id: 'pyramid',  label: 'Pyramid',  icon: '▲' },
    { id: 'prism',    label: 'Prism',    icon: '▭' },
    { id: 'none',     label: 'None',     icon: '○'  },
];

// LeftPanel class
export class LeftPanel {
    constructor() {
        this.isOpen       = false;
        this.callbacks    = {};   // { onObjType, onGenerate, onUpload, onDeleteModel, onToggle, onExportJSON, onChartPanel, onStateChange }
        this.perfData     = null; // pointer ke perfMonitor.snapshot
        this.cameraRef    = null;
        this._modelLoaded = false;
        this._currentType = 'cube';
    }

    /** Inject HTML+CSS dan bind semua events */
    mount(callbacks = {}) {
        this.callbacks = callbacks;

        // Inject styles
        if (!document.getElementById('lp-styles')) {
            const style = document.createElement('style');
            style.id = 'lp-styles';
            style.textContent = PANEL_CSS;
            document.head.appendChild(style);
        }

        // Inject HTML
        const wrapper = document.createElement('div');
        wrapper.innerHTML = PANEL_HTML;
        document.body.appendChild(wrapper);

        // Build object type buttons
        this._buildObjGrid();

        // Bind all interactions
        this._bindToggle();
        this._bindSections();
        this._bindObjectType();
        this._bindUpload();
        this._bindScene();
        this._bindCullingToggles();
        this._bindPerf();
    }

    // ── Public: update performance display ──
    updatePerf(snap, camera, drawnObjects, culledObjects, total) {
        const fps     = document.getElementById('lp-fps');
        const framems = document.getElementById('lp-framems');
        const rendered= document.getElementById('lp-rendered');
        const culled  = document.getElementById('lp-culled');
        const totalEl = document.getElementById('lp-total');
        const dcEl    = document.getElementById('lp-drawcalls');
        const heapEl  = document.getElementById('lp-heap');
        const gpuEl   = document.getElementById('lp-gpu');
        const camEl   = document.getElementById('lp-campos');

        if (fps)     { fps.textContent = snap.fps; fps.style.color = snap.fps >= 50 ? '#00ff88' : snap.fps >= 30 ? '#ffe033' : '#ff4455'; }
        if (framems) framems.textContent = snap.cpuFrameMs.toFixed(1);
        if (rendered)rendered.textContent = drawnObjects.toLocaleString();
        if (culled)  culled.textContent   = culledObjects.toLocaleString();
        if (totalEl) totalEl.textContent  = total.toLocaleString();
        if (dcEl)    dcEl.textContent     = snap.drawCalls;
        if (heapEl)  heapEl.textContent   = snap.heapMB > 0 ? snap.heapMB.toFixed(0) : '—';
        if (gpuEl)   gpuEl.textContent    = snap.gpuFrameMs > 0 ? snap.gpuFrameMs.toFixed(1) : '—';
        if (camEl && camera) {
            const p = camera.position;
            camEl.textContent = `CAM: ${p[0].toFixed(0)}, ${p[1].toFixed(0)}, ${p[2].toFixed(0)}`;
        }
    }

    // ── Public: update slider & count label when state changes externally ──
    syncObjCount(count) {
        const slider = document.getElementById('lp-obj-slider');
        const numIn  = document.getElementById('lp-obj-num');
        if (slider) slider.value = count;
        if (numIn)  numIn.value  = count;
    }

    // PRIVATE: build / bind
    _buildObjGrid() {
        const grid = document.getElementById('obj-type-grid');
        if (!grid) return;
        OBJ_TYPES.forEach(t => {
            const btn = document.createElement('button');
            btn.className   = 'obj-btn' + (t.id === this._currentType ? ' active' : '');
            btn.dataset.type = t.id;
            btn.innerHTML   = `<span class="obj-icon">${t.icon}</span>${t.label}`;
            grid.appendChild(btn);
        });
    }

    _bindToggle() {
        const toggle = document.getElementById('left-panel-toggle');
        const panel  = document.getElementById('left-panel');
        const icon   = document.getElementById('toggle-icon');
        toggle?.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            panel.classList.toggle('open', this.isOpen);
            toggle.classList.toggle('open', this.isOpen);
            icon.textContent = this.isOpen ? '◀' : '▶';
            this.callbacks.onToggle?.(this.isOpen);
        });
    }

    _bindSections() {
        // Accordion — click header toggles body
        document.querySelectorAll('.lp-sec-header').forEach(header => {
            // Open performance section by default
            const targetId = header.dataset.target;
            const body = document.getElementById(targetId);
            if (!body) return;
            // "body-perf" starts open
            if (targetId === 'body-perf') body.classList.add('open');

            header.addEventListener('click', () => {
                const isOpen = body.classList.toggle('open');
                header.classList.toggle('collapsed', !isOpen);
            });
        });
    }

    _bindObjectType() {
        const grid = document.getElementById('obj-type-grid');
        grid?.addEventListener('click', e => {
            const btn = e.target.closest('.obj-btn');
            if (!btn) return;
            const type = btn.dataset.type;
            if (type === this._currentType) return;
            this._currentType = type;
            // Update active state
            grid.querySelectorAll('.obj-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
            this.callbacks.onObjType?.(type);
        });
    }

    _bindUpload() {
        const zone   = document.getElementById('upload-zone');
        const input  = document.getElementById('lp-file-input');
        const delBtn = document.getElementById('btn-delete-model');

        zone?.addEventListener('click', () => input?.click());

        // Drag & drop
        zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone?.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this._handleFile(file);
        });

        input?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this._handleFile(file);
        });

        // Scale — slider & number sync
        const scaleSync = (v) => {
            v = Math.max(0.1, Math.min(5, parseFloat(v) || 1));
            document.getElementById('ctrl-scale').value = v;
            document.getElementById('num-scale').value  = v.toFixed(1);
            this.callbacks.onModelScale?.(v);
        };
        document.getElementById('ctrl-scale')?.addEventListener('input',  e => scaleSync(e.target.value));
        document.getElementById('num-scale')?.addEventListener('input',   e => scaleSync(e.target.value));
        document.getElementById('num-scale')?.addEventListener('keydown', e => { if(e.key==='Enter') scaleSync(e.target.value); });

        // Rotate X — slider & number sync
        const rotXSync = (v) => {
            v = Math.max(-180, Math.min(180, parseInt(v) || 0));
            document.getElementById('ctrl-rotX').value = v;
            document.getElementById('num-rotX').value  = v;
            this.callbacks.onModelRotX?.(v);
        };
        document.getElementById('ctrl-rotX')?.addEventListener('input',  e => rotXSync(e.target.value));
        document.getElementById('num-rotX')?.addEventListener('input',   e => rotXSync(e.target.value));
        document.getElementById('num-rotX')?.addEventListener('keydown', e => { if(e.key==='Enter') rotXSync(e.target.value); });

        // Rotate Y — slider & number sync
        const rotYSync = (v) => {
            v = Math.max(-180, Math.min(180, parseInt(v) || 0));
            document.getElementById('ctrl-rotY').value = v;
            document.getElementById('num-rotY').value  = v;
            this.callbacks.onModelRotY?.(v);
        };
        document.getElementById('ctrl-rotY')?.addEventListener('input',  e => rotYSync(e.target.value));
        document.getElementById('num-rotY')?.addEventListener('input',   e => rotYSync(e.target.value));
        document.getElementById('num-rotY')?.addEventListener('keydown', e => { if(e.key==='Enter') rotYSync(e.target.value); });

        delBtn?.addEventListener('click', () => {
            this._modelLoaded = false;
            document.getElementById('model-controls').style.display = 'none';
            document.getElementById('upload-zone').style.display = '';
            this.callbacks.onDeleteModel?.();
        });
    }

    _handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        document.getElementById('model-name').textContent = file.name;
        document.getElementById('upload-zone').style.display = 'none';
        document.getElementById('model-controls').style.display = '';
        this._modelLoaded = true;
        this.callbacks.onUpload?.(file, ext);
    }

    _bindScene() {
        const slider = document.getElementById('lp-obj-slider');
        const numIn  = document.getElementById('lp-obj-num');
        let debounce = null;

        const applyCount = (v) => {
            v = Math.max(1, Math.min(50000, parseInt(v) || 1));
            if (slider) slider.value = v;
            if (numIn)  numIn.value  = v;
            clearTimeout(debounce);
            debounce = setTimeout(() => this.callbacks.onObjCount?.(v), 400);
        };

        slider?.addEventListener('input', e => applyCount(e.target.value));
        slider?.addEventListener('change', e => { clearTimeout(debounce); this.callbacks.onObjCount?.(parseInt(e.target.value)); });

        numIn?.addEventListener('input', e => applyCount(e.target.value));
        numIn?.addEventListener('change', e => { clearTimeout(debounce); applyCount(e.target.value); this.callbacks.onObjCount?.(Math.max(1, parseInt(e.target.value) || 1)); });
        // Allow Enter key to apply immediately
        numIn?.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(debounce); this.callbacks.onObjCount?.(Math.max(1, parseInt(numIn.value) || 1)); } });

        document.getElementById('lp-sel-mode')?.addEventListener('change', e =>
            this.callbacks.onMode?.(e.target.value));
        document.getElementById('lp-sel-palette')?.addEventListener('change', e =>
            this.callbacks.onPalette?.(parseInt(e.target.value)));
        document.getElementById('lp-btn-generate')?.addEventListener('click', () =>
            this.callbacks.onGenerate?.());
    }

    _bindCullingToggles() {
        const map = {
            'lp-toggleFrustum':   'useFrustum',
            'lp-toggleOctree':    'useOctree',
            'lp-toggleOcclusion': 'useOcclusion',
            'lp-toggleLOD':       'useLOD',
            'lp-toggleBBox':      'showBBox',
            'lp-toggleLODColor':  'showLODColor',
        };
        Object.entries(map).forEach(([id, key]) => {
            document.getElementById(id)?.addEventListener('change', e =>
                this.callbacks.onStateChange?.(key, e.target.checked));
        });
    }

    _bindPerf() {
        document.getElementById('lp-btn-chartpanel')?.addEventListener('click', () =>
            this.callbacks.onChartPanel?.());
        document.getElementById('lp-btn-export')?.addEventListener('click', () =>
            this.callbacks.onExportJSON?.());
    }

    /** Sync toggle checkboxes to external state object */
    syncState(state) {
        const map = {
            'lp-toggleFrustum':   'useFrustum',
            'lp-toggleOctree':    'useOctree',
            'lp-toggleOcclusion': 'useOcclusion',
            'lp-toggleLOD':       'useLOD',
            'lp-toggleBBox':      'showBBox',
            'lp-toggleLODColor':  'showLODColor',
        };
        Object.entries(map).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!state[key];
        });
    }
}
