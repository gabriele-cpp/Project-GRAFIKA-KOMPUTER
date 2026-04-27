const HTML = `
<div id="research-toggle">LAB</div>
<aside id="research-panel">
  <div class="rp-header">
    <div class="rp-title">Research Lab</div>
    <div class="rp-sub">Hybrid 2.0 / Benchmark / Replay</div>
  </div>

  <section class="rp-section">
    <div class="rp-label">Hybrid Controls</div>
    <label class="rp-toggle-row"><span>Temporal Coherence</span><input type="checkbox" id="rp-temporal" checked></label>
    <label class="rp-toggle-row"><span>Predictive Culling</span><input type="checkbox" id="rp-predictive" checked></label>
    <label class="rp-toggle-row"><span>Adaptive Budget</span><input type="checkbox" id="rp-budget"></label>
    <label class="rp-toggle-row"><span>Heatmap Overlay</span><input type="checkbox" id="rp-heatmap"></label>
    <label class="rp-toggle-row"><span>Instancing Path</span><input type="checkbox" id="rp-instancing" checked></label>
    <label class="rp-toggle-row"><span>Occlusion Grid Overlay</span><input type="checkbox" id="rp-occlusion-overlay"></label>
  </section>

  <section class="rp-section">
    <div class="rp-label">Occlusion Tuning</div>
    <label class="rp-range-row">
      <span>Grid Resolution</span>
      <strong id="rp-occlusion-res-label">24</strong>
    </label>
    <input type="range" id="rp-occlusion-res" min="8" max="64" step="2" value="24">
  </section>

  <section class="rp-section">
    <div class="rp-label">LOD Thresholds</div>
    <label class="rp-range-row"><span>Near</span><strong id="rp-lod-near-label">150</strong></label>
    <input type="range" id="rp-lod-near" min="40" max="300" step="5" value="150">
    <label class="rp-range-row"><span>Mid</span><strong id="rp-lod-mid-label">350</strong></label>
    <input type="range" id="rp-lod-mid" min="120" max="600" step="5" value="350">
    <label class="rp-range-row"><span>Far</span><strong id="rp-lod-far-label">600</strong></label>
    <input type="range" id="rp-lod-far" min="220" max="1000" step="10" value="600">
    <label class="rp-range-row"><span>Transition Band</span><strong id="rp-lod-band-label">45</strong></label>
    <input type="range" id="rp-lod-band" min="10" max="140" step="1" value="45">
  </section>

  <section class="rp-section">
    <div class="rp-label">Scene Complexity</div>
    <select id="rp-complexity">
      <option value="low">Low</option>
      <option value="medium" selected>Medium</option>
      <option value="high">High</option>
    </select>
    <div class="rp-inline-row">
      <input type="number" id="rp-scene-seed" min="0" max="999999999" step="1" value="1337" />
      <button class="rp-btn" id="rp-random-seed">Random Seed</button>
    </div>
    <button class="rp-btn" id="rp-generate-complexity">Generate Preset Scene</button>
  </section>

  <section class="rp-section">
    <div class="rp-label">Camera Path</div>
    <label class="rp-toggle-row"><span>Smoothing Replay</span><input type="checkbox" id="rp-path-smoothing" checked></label>
    <label class="rp-toggle-row"><span>Constant Speed Replay</span><input type="checkbox" id="rp-path-constant" checked></label>
    <div class="rp-btn-row">
      <button class="rp-btn" id="rp-record">Record</button>
      <button class="rp-btn" id="rp-stop-record">Stop</button>
    </div>
    <div class="rp-btn-row">
      <button class="rp-btn" id="rp-replay">Replay</button>
      <button class="rp-btn" id="rp-export-path">Export Path</button>
    </div>
    <button class="rp-btn" id="rp-import-path">Import Path</button>
    <input type="file" id="rp-path-input" accept=".json" style="display:none">
  </section>

  <section class="rp-section">
    <div class="rp-label">Benchmark</div>
    <button class="rp-btn rp-btn-accent" id="rp-start-benchmark">Run 6-Technique Benchmark</button>
    <button class="rp-btn" id="rp-start-benchmark-matrix">Run Matrix (Low/Med/High/Voxel/Dungeon)</button>
    <div class="rp-btn-row">
      <button class="rp-btn" id="rp-export-benchmark-json">Export JSON</button>
      <button class="rp-btn" id="rp-export-benchmark-csv">Export CSV</button>
    </div>
  </section>

  <section class="rp-section">
    <div class="rp-label">Runtime Status</div>
    <div class="rp-stat"><span>Path</span><strong id="rp-path-status">idle</strong></div>
    <div class="rp-stat"><span>Benchmark</span><strong id="rp-benchmark-status">idle</strong></div>
    <div class="rp-stat"><span>Quality</span><strong id="rp-quality-status">high</strong></div>
    <div class="rp-stat"><span>Stage ms</span><strong id="rp-stage-status">0 / 0 / 0 / 0</strong></div>
    <div class="rp-stat"><span>Reuse / Predict</span><strong id="rp-hybrid-status">0 / 0</strong></div>
  </section>
</aside>
`;

const CSS = `
#research-toggle {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 130;
  background: rgba(7, 14, 30, 0.94);
  color: #7cf2ff;
  border: 1px solid rgba(124, 242, 255, 0.2);
  border-radius: 999px;
  padding: 9px 14px;
  font: 600 12px 'Share Tech Mono', monospace;
  letter-spacing: 0.12em;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

#research-panel {
  position: fixed;
  right: 18px;
  bottom: 64px;
  width: 320px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  z-index: 129;
  background: rgba(5, 10, 24, 0.96);
  border: 1px solid rgba(124, 242, 255, 0.16);
  border-radius: 16px;
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.38);
  color: #cbe2ef;
  font-family: 'Exo 2', sans-serif;
  transform: translateY(16px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

#research-panel.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.rp-header {
  padding: 16px 18px 10px;
  border-bottom: 1px solid rgba(124, 242, 255, 0.1);
}

.rp-title {
  font: 700 14px 'Exo 2', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7cf2ff;
}

.rp-sub {
  margin-top: 4px;
  font: 11px 'Share Tech Mono', monospace;
  color: #5f7a8b;
}

.rp-section {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(124, 242, 255, 0.08);
}

.rp-label {
  margin-bottom: 10px;
  font: 600 11px 'Share Tech Mono', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7cf2ff;
}

.rp-toggle-row,
.rp-stat,
.rp-range-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
}

.rp-stat strong,
.rp-range-row strong {
  color: #f4f8fb;
  font: 600 11px 'Share Tech Mono', monospace;
}

.rp-btn,
#research-panel select,
#research-panel input[type=number] {
  width: 100%;
  border: 1px solid rgba(124, 242, 255, 0.18);
  border-radius: 10px;
  background: rgba(124, 242, 255, 0.05);
  color: #cbe2ef;
  padding: 9px 10px;
  font: 12px 'Exo 2', sans-serif;
}

#research-panel input[type=range] {
  width: 100%;
  margin: 0 0 10px;
}

.rp-inline-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.rp-btn {
  cursor: pointer;
}

.rp-btn:hover {
  background: rgba(124, 242, 255, 0.12);
}

.rp-btn-accent {
  background: linear-gradient(135deg, rgba(0, 200, 255, 0.14), rgba(0, 255, 136, 0.12));
}

.rp-btn-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}
`;

export class ResearchPanel {
    constructor() {
        this.callbacks = {};
        this.open = false;
    }

    mount(callbacks = {}) {
        this.callbacks = callbacks;
        if (!document.getElementById('research-panel-styles')) {
            const style = document.createElement('style');
            style.id = 'research-panel-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = HTML;
        document.body.appendChild(wrapper);

        const toggle = document.getElementById('research-toggle');
        const panel = document.getElementById('research-panel');
        toggle?.addEventListener('click', () => {
            this.open = !this.open;
            panel.classList.toggle('open', this.open);
        });

        const boolMap = {
            'rp-temporal': 'useTemporalCoherence',
            'rp-predictive': 'usePredictiveCulling',
            'rp-budget': 'useAdaptiveBudget',
            'rp-heatmap': 'showHeatmap',
            'rp-instancing': 'useInstancing',
            'rp-occlusion-overlay': 'showOcclusionGrid',
        };
        Object.entries(boolMap).forEach(([id, key]) => {
            document.getElementById(id)?.addEventListener('change', event => {
                this.callbacks.onToggleState?.(key, event.target.checked);
            });
        });

        this._bindRange('rp-occlusion-res', 'rp-occlusion-res-label', value => {
            this.callbacks.onSetOcclusionResolution?.(value);
        }, value => String(Math.round(value)));
        this._bindRange('rp-lod-near', 'rp-lod-near-label', value => {
            this.callbacks.onSetLodThresholds?.({ near: value });
        }, value => String(Math.round(value)));
        this._bindRange('rp-lod-mid', 'rp-lod-mid-label', value => {
            this.callbacks.onSetLodThresholds?.({ mid: value });
        }, value => String(Math.round(value)));
        this._bindRange('rp-lod-far', 'rp-lod-far-label', value => {
            this.callbacks.onSetLodThresholds?.({ far: value });
        }, value => String(Math.round(value)));
        this._bindRange('rp-lod-band', 'rp-lod-band-label', value => {
            this.callbacks.onSetLodThresholds?.({ transitionBand: value });
        }, value => String(Math.round(value)));

        const notifyReplayOptions = () => {
            const smoothing = !!document.getElementById('rp-path-smoothing')?.checked;
            const constantSpeed = !!document.getElementById('rp-path-constant')?.checked;
            this.callbacks.onSetReplayOptions?.({ smoothing, constantSpeed });
        };
        document.getElementById('rp-path-smoothing')?.addEventListener('change', notifyReplayOptions);
        document.getElementById('rp-path-constant')?.addEventListener('change', notifyReplayOptions);
        notifyReplayOptions();

        const seedInput = document.getElementById('rp-scene-seed');
        seedInput?.addEventListener('change', () => {
            const parsed = Number.parseInt(seedInput.value, 10);
            if (Number.isFinite(parsed)) this.callbacks.onSetSceneSeed?.(parsed);
        });
        document.getElementById('rp-random-seed')?.addEventListener('click', () => {
            const seed = Math.floor(Math.random() * 1_000_000_000);
            if (seedInput) seedInput.value = String(seed);
            this.callbacks.onSetSceneSeed?.(seed);
        });

        document.getElementById('rp-generate-complexity')?.addEventListener('click', () => {
            const level = document.getElementById('rp-complexity')?.value || 'medium';
            this.callbacks.onGenerateComplexity?.(level);
        });

        document.getElementById('rp-record')?.addEventListener('click', () => this.callbacks.onRecord?.());
        document.getElementById('rp-stop-record')?.addEventListener('click', () => this.callbacks.onStopRecord?.());
        document.getElementById('rp-replay')?.addEventListener('click', () => this.callbacks.onReplay?.());
        document.getElementById('rp-export-path')?.addEventListener('click', () => this.callbacks.onExportPath?.());
        document.getElementById('rp-start-benchmark')?.addEventListener('click', () => this.callbacks.onStartBenchmark?.());
        document.getElementById('rp-start-benchmark-matrix')?.addEventListener('click', () => this.callbacks.onStartBenchmarkMatrix?.());
        document.getElementById('rp-export-benchmark-json')?.addEventListener('click', () => this.callbacks.onExportBenchmark?.('json'));
        document.getElementById('rp-export-benchmark-csv')?.addEventListener('click', () => this.callbacks.onExportBenchmark?.('csv'));

        const pathInput = document.getElementById('rp-path-input');
        document.getElementById('rp-import-path')?.addEventListener('click', () => pathInput?.click());
        pathInput?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            this.callbacks.onImportPath?.(text);
            pathInput.value = '';
        });
    }

    syncState(state) {
        const map = {
            'rp-temporal': !!state.useTemporalCoherence,
            'rp-predictive': !!state.usePredictiveCulling,
            'rp-budget': !!state.useAdaptiveBudget,
            'rp-heatmap': !!state.showHeatmap,
            'rp-instancing': !!state.useInstancing,
            'rp-occlusion-overlay': !!state.showOcclusionGrid,
            'rp-path-smoothing': !!state.cameraPathSmoothing,
            'rp-path-constant': !!state.cameraPathConstantSpeed,
        };
        Object.entries(map).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.checked = value;
        });

        this._setRange('rp-occlusion-res', 'rp-occlusion-res-label', state.occlusionResolution, value => String(Math.round(value)));
        this._setRange('rp-lod-near', 'rp-lod-near-label', state.lodNear, value => String(Math.round(value)));
        this._setRange('rp-lod-mid', 'rp-lod-mid-label', state.lodMid, value => String(Math.round(value)));
        this._setRange('rp-lod-far', 'rp-lod-far-label', state.lodFar, value => String(Math.round(value)));
        this._setRange('rp-lod-band', 'rp-lod-band-label', state.lodTransitionBand, value => String(Math.round(value)));

        const seedInput = document.getElementById('rp-scene-seed');
        if (seedInput && Number.isFinite(state.sceneSeed)) seedInput.value = String(Math.floor(state.sceneSeed));
    }

    updateStatus(status = {}) {
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        setText('rp-path-status', status.path || 'idle');
        setText('rp-benchmark-status', status.benchmark || 'idle');
        setText('rp-quality-status', status.quality || 'high');
        setText('rp-stage-status', status.stageMs || '0 / 0 / 0 / 0');
        setText('rp-hybrid-status', status.hybrid || '0 / 0');
    }

    _bindRange(id, labelId, onChange, format = value => String(value)) {
        const input = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (!input) return;
        const apply = raw => {
            const value = Number.parseFloat(raw);
            if (!Number.isFinite(value)) return;
            if (label) label.textContent = format(value);
            onChange?.(value);
        };
        input.addEventListener('input', event => apply(event.target.value));
        apply(input.value);
    }

    _setRange(id, labelId, value, format = v => String(v)) {
        const input = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (input && Number.isFinite(value)) input.value = String(value);
        if (label && Number.isFinite(value)) label.textContent = format(value);
    }
}
