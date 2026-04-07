// ============================================================
// ui/import-panel.js  [BARU]
//
// Right sidebar panel khusus Import Object.
// Fitur:
//   - Drag & drop / file picker GLTF / GLB / OBJ
//   - Objek ditampilkan AS-IS (tanpa auto-scale/adjustment)
//   - Instancing 1–100 objek
//   - Scale: Uniform + per-axis X/Y/Z
//   - Mouse drag (klik+drag) = Translate posisi
//   - Mouse drag + Shift     = Rotate objek
//   - Tombol hapus model
//
// TIDAK menyentuh pipeline WebGL utama sama sekali.
// Berkomunikasi ke main.js via callbacks.
// ============================================================

// ─── CSS ─────────────────────────────────────────────────────
const CSS = `
:root {
  --ip-w: 280px;
  --ip-bg: rgba(4, 6, 20, 0.97);
  --ip-border: rgba(0, 200, 255, 0.14);
  --ip-accent: #00c8ff;
  --ip-accent2: #7b2fff;
  --ip-green: #00ff88;
  --ip-red: #ff4455;
  --ip-text: #b8ccd8;
  --ip-dim: #445566;
  --ip-mono: 'Share Tech Mono', monospace;
  --ip-ui: 'Exo 2', sans-serif;
}

/* ── Toggle button (right side) ── */
#ip-toggle {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 120;
  width: 22px;
  height: 56px;
  background: rgba(0,200,255,0.12);
  border: 1px solid var(--ip-border);
  border-right: none;
  border-radius: 6px 0 0 6px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: right 0.35s cubic-bezier(.4,0,.2,1), background 0.2s;
  font-size: 0.7rem;
  color: var(--ip-accent);
  user-select: none;
  backdrop-filter: blur(8px);
}
#ip-toggle:hover { background: rgba(0,200,255,0.25); }
#ip-toggle.open { right: var(--ip-w); }

/* ── Sidebar ── */
#import-panel {
  position: fixed;
  top: 0; right: 0;
  width: var(--ip-w);
  height: 100vh;
  z-index: 110;
  background: var(--ip-bg);
  border-left: 1px solid var(--ip-border);
  backdrop-filter: blur(18px);
  overflow-y: auto;
  overflow-x: hidden;
  transform: translateX(var(--ip-w));
  transition: transform 0.35s cubic-bezier(.4,0,.2,1);
  font-family: var(--ip-ui);
  color: var(--ip-text);
  scrollbar-width: thin;
  scrollbar-color: rgba(0,200,255,0.25) transparent;
}
#import-panel.open { transform: translateX(0); }
#import-panel::-webkit-scrollbar { width: 3px; }
#import-panel::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.3); border-radius: 3px; }

/* ── Header ── */
.ip-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--ip-border);
  position: sticky; top: 0; z-index: 2;
  background: var(--ip-bg);
}
.ip-logo { font-size: 1.1rem; color: var(--ip-accent); }
.ip-title {
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--ip-accent);
}

/* ── Sections ── */
.ip-section { border-bottom: 1px solid rgba(0,200,255,0.07); padding: 14px 16px; }
.ip-sec-title {
  font-size: 0.6rem; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--ip-dim); margin-bottom: 12px;
  display: flex; align-items: center; gap: 6px;
}
.ip-sec-title::before {
  content: '';
  display: inline-block; width: 3px; height: 10px;
  background: var(--ip-accent); border-radius: 2px;
}

/* ── Upload zone ── */
.ip-upload-zone {
  border: 1px dashed rgba(0,200,255,0.3);
  border-radius: 10px;
  padding: 24px 12px;
  text-align: center;
  cursor: pointer;
  transition: 0.2s;
  background: rgba(0,200,255,0.02);
}
.ip-upload-zone:hover,
.ip-upload-zone.drag-over {
  border-color: var(--ip-accent);
  background: rgba(0,200,255,0.07);
}
.ip-upload-icon {
  font-size: 2rem; color: var(--ip-accent);
  margin-bottom: 8px;
  display: block;
}
.ip-upload-label { font-size: 0.75rem; color: var(--ip-text); font-weight: 600; }
.ip-upload-formats {
  font-size: 0.58rem; color: var(--ip-dim);
  margin-top: 4px;
  font-family: var(--ip-mono);
}

/* ── Loading bar ── */
.ip-loading {
  display: none;
  margin-top: 10px;
}
.ip-loading.show { display: block; }
.ip-loading-bar {
  height: 2px;
  background: rgba(0,200,255,0.15);
  border-radius: 2px;
  overflow: hidden;
}
.ip-loading-fill {
  height: 100%;
  background: var(--ip-accent);
  border-radius: 2px;
  transition: width 0.2s;
  box-shadow: 0 0 6px var(--ip-accent);
}
.ip-loading-text {
  font-size: 0.6rem; color: var(--ip-dim);
  font-family: var(--ip-mono);
  margin-top: 4px; text-align: center;
}

/* ── Model info ── */
.ip-model-info {
  display: none;
  background: rgba(0,200,255,0.04);
  border: 1px solid var(--ip-border);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.ip-model-info.show { display: block; }
.ip-model-filename {
  font-family: var(--ip-mono);
  font-size: 0.65rem;
  color: var(--ip-accent);
  word-break: break-all;
}
.ip-model-meta {
  font-size: 0.58rem; color: var(--ip-dim);
  margin-top: 3px;
}

/* ── Controls (hidden until model loaded) ── */
.ip-controls { display: none; }
.ip-controls.show { display: block; }

/* ── Field ── */
.ip-field { margin-bottom: 12px; }
.ip-label {
  font-size: 0.62rem; color: var(--ip-dim);
  letter-spacing: 0.05em;
  display: flex; justify-content: space-between;
  margin-bottom: 5px;
}
.ip-label span { color: var(--ip-accent); font-family: var(--ip-mono); }

.ip-slider-row {
  display: flex; align-items: center; gap: 7px;
}
.ip-slider-row input[type=range] {
  flex: 1;
  -webkit-appearance: none;
  height: 3px;
  background: rgba(0,200,255,0.15);
  border-radius: 3px; outline: none;
}
.ip-slider-row input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--ip-accent);
  box-shadow: 0 0 5px var(--ip-accent);
  cursor: pointer;
}

.ip-num {
  width: 58px; flex-shrink: 0;
  background: rgba(0,200,255,0.06);
  border: 1px solid var(--ip-border);
  border-radius: 4px;
  color: var(--ip-accent);
  font-family: var(--ip-mono);
  font-size: 0.7rem;
  padding: 3px 6px;
  text-align: right; outline: none;
  -moz-appearance: textfield;
}
.ip-num::-webkit-outer-spin-button,
.ip-num::-webkit-inner-spin-button { -webkit-appearance: none; }
.ip-num:focus {
  border-color: var(--ip-accent);
  box-shadow: 0 0 6px rgba(0,200,255,0.2);
}

/* ── Axis scale grid ── */
.ip-axis-grid {
  display: grid;
  grid-template-columns: 16px 1fr 50px;
  gap: 5px 7px;
  align-items: center;
}
.ip-axis-label {
  font-family: var(--ip-mono);
  font-size: 0.65rem;
  font-weight: 700;
  text-align: center;
}
.ip-axis-label.x { color: #ff6b6b; }
.ip-axis-label.y { color: #6bff8e; }
.ip-axis-label.z { color: #6bb3ff; }
.ip-axis-label.u { color: var(--ip-accent); }
.ip-axis-grid input[type=range] {
  -webkit-appearance: none;
  height: 3px;
  background: rgba(0,200,255,0.15);
  border-radius: 3px; outline: none; width: 100%;
}
.ip-axis-grid input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--ip-accent);
  box-shadow: 0 0 4px var(--ip-accent);
  cursor: pointer;
}

/* ── Mouse control hint ── */
.ip-mouse-hint {
  background: rgba(0,200,255,0.04);
  border: 1px solid var(--ip-border);
  border-radius: 6px;
  padding: 8px 10px;
}
.ip-mouse-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.62rem; color: var(--ip-dim);
  margin-bottom: 5px;
}
.ip-mouse-row:last-child { margin-bottom: 0; }
.ip-mouse-key {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 1px 6px;
  font-family: var(--ip-mono);
  font-size: 0.58rem;
  color: var(--ip-text);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Buttons ── */
.ip-btn {
  display: block; width: 100%;
  padding: 9px;
  border: 1px solid var(--ip-border);
  border-radius: 6px;
  background: rgba(0,200,255,0.06);
  color: var(--ip-accent);
  font-family: var(--ip-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  cursor: pointer; text-align: center;
  transition: 0.15s; margin-bottom: 7px;
}
.ip-btn:last-child { margin-bottom: 0; }
.ip-btn:hover { background: rgba(0,200,255,0.15); }
.ip-btn-danger {
  background: rgba(255,68,85,0.07);
  border-color: rgba(255,68,85,0.25);
  color: var(--ip-red);
}
.ip-btn-danger:hover { background: rgba(255,68,85,0.18); }

/* ── Divider ── */
.ip-divider {
  height: 1px;
  background: var(--ip-border);
  margin: 10px 0;
}
`;

// ─── HTML template ────────────────────────────────────────────
const HTML = `
<div id="ip-toggle" title="Import Object Panel">▶</div>

<aside id="import-panel">
  <div class="ip-header">
    <span class="ip-logo">⬆</span>
    <span class="ip-title">Import Object</span>
  </div>

  <!-- ══ UPLOAD ══ -->
  <div class="ip-section">
    <div class="ip-sec-title">Upload File</div>

    <div class="ip-upload-zone" id="ip-upload-zone">
      <span class="ip-upload-icon">⬆</span>
      <div class="ip-upload-label">Drag & drop file here</div>
      <div class="ip-upload-formats">GLTF · GLB · OBJ · BIN</div>
    </div>
    <input type="file" id="ip-file-input" accept=".gltf,.glb,.obj,.bin,.mtl,.png,.jpg,.jpeg,.webp,.ktx2" multiple style="display:none">

    <div class="ip-loading" id="ip-loading">
      <div class="ip-loading-bar">
        <div class="ip-loading-fill" id="ip-loading-fill" style="width:0%"></div>
      </div>
      <div class="ip-loading-text" id="ip-loading-text">Loading...</div>
    </div>

    <div class="ip-model-info" id="ip-model-info">
      <div class="ip-model-filename" id="ip-model-filename">—</div>
      <div class="ip-model-meta" id="ip-model-meta"></div>
    </div>
  </div>

  <!-- ══ CONTROLS (shown after load) ══ -->
  <div class="ip-controls" id="ip-controls">

    <!-- Instance count -->
    <div class="ip-section">
      <div class="ip-sec-title">Instances</div>
      <div class="ip-field">
        <label class="ip-label">Count <span id="ip-val-count">1</span></label>
        <div class="ip-slider-row">
          <input type="range" id="ip-slider-count" min="1" max="1000" step="1" value="1">
          <input type="number" class="ip-num" id="ip-num-count" min="1" max="1000" step="1" value="1">
        </div>
      </div>
    </div>

    <!-- Scale -->
    <div class="ip-section">
      <div class="ip-sec-title">Scale</div>

      <div class="ip-field">
        <label class="ip-label">Uniform <span id="ip-val-scale-u">1.00</span></label>
        <div class="ip-slider-row">
          <input type="range" id="ip-slider-scale-u" min="0.01" max="10" step="0.01" value="1">
          <input type="number" class="ip-num" id="ip-num-scale-u" min="0.01" max="10" step="0.01" value="1">
        </div>
      </div>

      <div class="ip-divider"></div>

      <div class="ip-field" style="margin-bottom:4px">
        <label class="ip-label" style="margin-bottom:8px">Per Axis</label>
        <div class="ip-axis-grid">
          <span class="ip-axis-label x">X</span>
          <input type="range" id="ip-slider-scale-x" min="0.01" max="10" step="0.01" value="1">
          <input type="number" class="ip-num" id="ip-num-scale-x" min="0.01" max="10" step="0.01" value="1">

          <span class="ip-axis-label y">Y</span>
          <input type="range" id="ip-slider-scale-y" min="0.01" max="10" step="0.01" value="1">
          <input type="number" class="ip-num" id="ip-num-scale-y" min="0.01" max="10" step="0.01" value="1">

          <span class="ip-axis-label z">Z</span>
          <input type="range" id="ip-slider-scale-z" min="0.01" max="10" step="0.01" value="1">
          <input type="number" class="ip-num" id="ip-num-scale-z" min="0.01" max="10" step="0.01" value="1">
        </div>
      </div>
    </div>

    <!-- Mouse Controls -->
    <div class="ip-section">
      <div class="ip-sec-title">Mouse Controls</div>
      <div class="ip-mouse-hint">
        <div class="ip-mouse-row">
          <span class="ip-mouse-key">Drag</span>
          <span>Move / Translate object</span>
        </div>
        <div class="ip-mouse-row">
          <span class="ip-mouse-key">Shift+Drag</span>
          <span>Rotate object</span>
        </div>
        <div class="ip-mouse-row">
          <span class="ip-mouse-key">Click</span>
          <span>on scene to deselect</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="ip-section">
      <div class="ip-sec-title">Actions</div>
      <button class="ip-btn ip-btn-danger" id="ip-btn-remove">✕ Remove Model</button>
    </div>

  </div><!-- /ip-controls -->
</aside>
`;

// ─── ImportPanel class ────────────────────────────────────────
export class ImportPanel {
    constructor() {
        this.isOpen      = false;
        this.callbacks   = {};
        this._modelLoaded = false;
        this._instanceCount = 1;
        this._scaleU = 1.0;
        this._scaleX = 1.0;
        this._scaleY = 1.0;
        this._scaleZ = 1.0;
    }

    mount(callbacks = {}) {
        this.callbacks = callbacks;

        // Inject CSS
        if (!document.getElementById('ip-styles')) {
            const style = document.createElement('style');
            style.id = 'ip-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        // Inject HTML
        const wrapper = document.createElement('div');
        wrapper.innerHTML = HTML;
        document.body.appendChild(wrapper);

        this._bindToggle();
        this._bindUpload();
        this._bindControls();
    }

    // ── Public: show loading progress ──
    setProgress(pct) {
        const fill = document.getElementById('ip-loading-fill');
        const text = document.getElementById('ip-loading-text');
        const bar  = document.getElementById('ip-loading');
        if (!fill) return;
        bar.classList.add('show');
        fill.style.width = pct + '%';
        if (text) text.textContent = pct < 100 ? `Loading... ${pct}%` : 'Done!';
        if (pct >= 100) setTimeout(() => bar?.classList.remove('show'), 800);
    }

    // ── Public: show loaded model info ──
    setModelLoaded(filename, meta = '') {
        this._modelLoaded = true;
        document.getElementById('ip-model-info').classList.add('show');
        document.getElementById('ip-model-filename').textContent = filename;
        document.getElementById('ip-model-meta').textContent = meta;
        document.getElementById('ip-controls').classList.add('show');
        document.getElementById('ip-loading')?.classList.remove('show');
    }

    // ── Public: sync scale slider setelah auto-scale dari importer ──
    syncScale(v) {
        v = Math.max(0.01, Math.min(10, v));
        this._scaleU = v;
        this._scaleX = v;
        this._scaleY = v;
        this._scaleZ = v;
        // _setAxisValue(axis, v): axis adalah lowercase untuk DOM id
        // property key: _scale{UPPERCASE}
        ['u','x','y','z'].forEach(a => this._setAxisValue(a, v));
        const label = document.getElementById('ip-val-scale-u');
        if (label) label.textContent = v.toFixed(2);
    }

    // ── Public: reset to empty state ──
    reset() {
        this._modelLoaded = false;
        document.getElementById('ip-model-info')?.classList.remove('show');
        document.getElementById('ip-controls')?.classList.remove('show');
        // Reset file input agar user bisa upload file yang sama lagi
        const input = document.getElementById('ip-file-input');
        if (input) input.value = '';
        this._resetSliders();
    }

    // ─── Private ────────────────────────────────────────────

    _bindToggle() {
        const btn   = document.getElementById('ip-toggle');
        const panel = document.getElementById('import-panel');
        btn?.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            panel.classList.toggle('open', this.isOpen);
            btn.classList.toggle('open', this.isOpen);
            btn.textContent = this.isOpen ? '▶' : '◀';
            this.callbacks.onToggle?.(this.isOpen);
        });
    }

    _bindUpload() {
        const zone  = document.getElementById('ip-upload-zone');
        const input = document.getElementById('ip-file-input');

        zone?.addEventListener('click',     () => input?.click());
        zone?.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone?.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this._handleFiles(e.dataTransfer.files);
        });
        input?.addEventListener('change', e => {
            if (e.target.files.length > 0) this._handleFiles(e.target.files);
        });

        document.getElementById('ip-btn-remove')?.addEventListener('click', () => {
            this.reset();
            this.callbacks.onRemove?.();
        });
    }

    _handleFiles(files) {
        // Konversi ke Array dulu SEBELUM apapun — FileList dari input adalah live reference
        // yang bisa ter-invalidate kalau input.value di-reset sebelum dipakai
        const fileArray = Array.from(files);
        const exts = fileArray.map(f => f.name.split('.').pop().toLowerCase());
        const validMain = exts.some(e => ['gltf','glb','obj'].includes(e));
        const hasBin    = exts.some(e => e === 'bin');

        // Reset file input SETELAH convert ke Array, agar event 'change' bisa
        // ter-trigger lagi jika user upload file yang sama
        const input = document.getElementById('ip-file-input');
        if (input) input.value = '';

        if (!validMain && hasBin) {
            this.callbacks.onError?.('.bin membutuhkan file .gltf atau .glb sebagai induk. Upload keduanya sekaligus.');
            return;
        }
        if (!validMain) {
            this.callbacks.onError?.('Format tidak didukung. Gunakan GLTF, GLB, atau OBJ.');
            return;
        }
        this.setProgress(0);
        this.callbacks.onUpload?.(fileArray);
    }

    _bindControls() {
        // ── Instance count ──
        this._syncPair('ip-slider-count', 'ip-num-count', 'ip-val-count',
            v => { this._instanceCount = v; this.callbacks.onInstanceCount?.(v); },
            1, 1000, 1, v => Math.round(v).toString()
        );

        // ── Uniform scale ──
        this._syncPair('ip-slider-scale-u', 'ip-num-scale-u', 'ip-val-scale-u',
            v => {
                this._scaleU = v;
                // Sync per-axis to uniform
                this._setAxisValue('x', v);
                this._setAxisValue('y', v);
                this._setAxisValue('z', v);
                this.callbacks.onScale?.({ u: v, x: v, y: v, z: v });
            },
            0.01, 10, 0.01, v => v.toFixed(2)
        );

        // ── Per-axis scale ──
        const onAxisChange = () => {
            const x = this._scaleX, y = this._scaleY, z = this._scaleZ;
            this.callbacks.onScale?.({ u: this._scaleU, x, y, z });
        };

        this._syncPair('ip-slider-scale-x', 'ip-num-scale-x', null,
            v => { this._scaleX = v; onAxisChange(); }, 0.01, 10, 0.01, v => v.toFixed(2));
        this._syncPair('ip-slider-scale-y', 'ip-num-scale-y', null,
            v => { this._scaleY = v; onAxisChange(); }, 0.01, 10, 0.01, v => v.toFixed(2));
        this._syncPair('ip-slider-scale-z', 'ip-num-scale-z', null,
            v => { this._scaleZ = v; onAxisChange(); }, 0.01, 10, 0.01, v => v.toFixed(2));
    }

    // Helper: bi-directional sync slider ↔ number input
    _syncPair(sliderId, numId, labelId, onChange, min, max, step, fmt) {
        const slider = document.getElementById(sliderId);
        const num    = document.getElementById(numId);
        const label  = labelId ? document.getElementById(labelId) : null;
        if (!slider || !num) return;

        const apply = (raw) => {
            let v = parseFloat(raw);
            if (isNaN(v)) v = min;
            v = Math.max(min, Math.min(max, v));
            slider.value = v;
            num.value    = step < 1 ? v.toFixed(2) : Math.round(v);
            if (label) label.textContent = fmt(v);
            onChange(v);
        };

        slider.addEventListener('input',  e => apply(e.target.value));
        num.addEventListener('input',     e => apply(e.target.value));
        num.addEventListener('change',    e => apply(e.target.value));
        num.addEventListener('keydown',   e => { if (e.key === 'Enter') apply(num.value); });
    }

    _setAxisValue(axis, v) {
        const axisKey = `_scale${axis.toUpperCase()}`;
        this[axisKey] = v;
        const slider = document.getElementById(`ip-slider-scale-${axis}`);
        const num    = document.getElementById(`ip-num-scale-${axis}`);
        if (slider) slider.value = v;
        if (num)    num.value    = v.toFixed(2);
    }

    _resetSliders() {
        ['u','x','y','z'].forEach(a => this._setAxisValue(a === 'u' ? 'U' : a, 1.0));
        this._scaleU = this._scaleX = this._scaleY = this._scaleZ = 1.0;
        const countSlider = document.getElementById('ip-slider-count');
        const countNum    = document.getElementById('ip-num-count');
        const countLabel  = document.getElementById('ip-val-count');
        if (countSlider) { countSlider.max = 1000; countSlider.value = 1; }
        if (countNum)    { countNum.max = 1000;    countNum.value    = 1; }
        if (countLabel)  countLabel.textContent = '1';
        this._instanceCount = 1;
    }
}
