// ============================================================
// ui/chart-panel.js  [BARU]
//
// Dashboard performa real-time dengan Chart.js
// Menampilkan 6 chart sekaligus:
//   1. FPS over time
//   2. CPU Frame Time (ms)
//   3. GPU Frame Time (ms) — jika browser support
//   4. JS Heap Memory (MB)
//   5. Rendered vs Culled objects
//   6. Culling Efficiency (%)
//
// + Summary card untuk nilai rata-rata, min, max
// + Tombol Export CSV untuk keperluan penelitian
// ============================================================

const CHART_COLOR = {
    fps:     { line: '#00ff88', fill: 'rgba(0,255,136,0.08)' },
    cpu:     { line: '#00c8ff', fill: 'rgba(0,200,255,0.08)' },
    gpu:     { line: '#7b2fff', fill: 'rgba(123,47,255,0.08)' },
    mem:     { line: '#ffe033', fill: 'rgba(255,224,51,0.08)' },
    render:  { line: '#00c8ff', fill: 'rgba(0,200,255,0.08)' },
    culled:  { line: '#ff4455', fill: 'rgba(255,68,85,0.08)'  },
    eff:     { line: '#00ff88', fill: 'rgba(0,255,136,0.08)'  },
    budget:  { line: '#ffe033', fill: 'rgba(255,224,51,0.08)' },
};

const CHART_DEFAULTS = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(4,5,15,0.95)',
            borderColor: 'rgba(0,200,255,0.3)',
            borderWidth: 1,
            titleColor: '#00c8ff',
            bodyColor: '#c8d8e8',
        }
    },
    scales: {
        x: {
            display: false,
            grid: { display: false },
        },
        y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#5a7080', font: { family: 'Share Tech Mono', size: 10 } },
            border: { color: 'rgba(0,200,255,0.15)' },
        }
    },
    elements: {
        point: { radius: 0 },
        line:  { tension: 0.3, borderWidth: 1.5 },
    }
};

function makeDataset(label, color, data = []) {
    return {
        label,
        data,
        borderColor:     color.line,
        backgroundColor: color.fill,
        fill:            true,
    };
}

// ============================================================
// BUILD DOM
// ============================================================
function buildPanelHTML() {
    return `
<div id="perf-overlay">
  <div id="perf-panel">

    <!-- Header -->
    <div class="perf-header">
      <div class="perf-title">
        <span class="perf-dot"></span>
        Performance Dashboard
      </div>
      <div class="perf-header-right">
        <button class="perf-btn" id="perf-export-csv">⬇ Export CSV</button>
        <button class="perf-btn perf-btn-json" id="perf-export-json">⬇ Export JSON</button>
        <button class="perf-btn" id="perf-clear">⟳ Clear</button>
        <button class="perf-close" id="perf-close">✕</button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="perf-cards">
      <div class="perf-card" id="card-fps">
        <div class="card-icon">⚡</div>
        <div class="card-body">
          <div class="card-val" id="cval-fps">—</div>
          <div class="card-lbl">FPS (avg)</div>
          <div class="card-sub" id="csub-fps">min — / max —</div>
        </div>
      </div>
      <div class="perf-card" id="card-cpu">
        <div class="card-icon">🖥</div>
        <div class="card-body">
          <div class="card-val" id="cval-cpu">—</div>
          <div class="card-lbl">CPU Frame (ms)</div>
          <div class="card-sub" id="csub-cpu">min — / max —</div>
        </div>
      </div>
      <div class="perf-card" id="card-gpu">
        <div class="card-icon">🎮</div>
        <div class="card-body">
          <div class="card-val" id="cval-gpu">—</div>
          <div class="card-lbl">GPU Frame (ms)</div>
          <div class="card-sub" id="csub-gpu">EXT_disjoint_timer</div>
        </div>
      </div>
      <div class="perf-card" id="card-mem">
        <div class="card-icon">💾</div>
        <div class="card-body">
          <div class="card-val" id="cval-mem">—</div>
          <div class="card-lbl">JS Heap (MB)</div>
          <div class="card-sub" id="csub-mem">limit —</div>
        </div>
      </div>
      <div class="perf-card" id="card-dc">
        <div class="card-icon">📐</div>
        <div class="card-body">
          <div class="card-val" id="cval-dc">—</div>
          <div class="card-lbl">Draw Calls</div>
          <div class="card-sub" id="csub-dc">per frame</div>
        </div>
      </div>
      <div class="perf-card" id="card-eff">
        <div class="card-icon">✂</div>
        <div class="card-body">
          <div class="card-val" id="cval-eff">—</div>
          <div class="card-lbl">Cull Efficiency</div>
          <div class="card-sub" id="csub-eff">% objects culled</div>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="perf-charts">

      <div class="chart-box">
        <div class="chart-title">FPS <span class="chart-unit">frames/sec</span></div>
        <div class="chart-wrap"><canvas id="ch-fps"></canvas></div>
      </div>

      <div class="chart-box">
        <div class="chart-title">CPU Frame Time <span class="chart-unit">ms</span>
          <span class="chart-ref">— 16.67ms = 60fps target</span>
        </div>
        <div class="chart-wrap"><canvas id="ch-cpu"></canvas></div>
      </div>

      <div class="chart-box">
        <div class="chart-title">GPU Frame Time <span class="chart-unit">ms</span>
          <span id="gpu-badge" class="chart-badge">checking…</span>
        </div>
        <div class="chart-wrap"><canvas id="ch-gpu"></canvas></div>
      </div>

      <div class="chart-box">
        <div class="chart-title">JS Heap Memory <span class="chart-unit">MB</span></div>
        <div class="chart-wrap"><canvas id="ch-mem"></canvas></div>
      </div>

      <div class="chart-box chart-wide">
        <div class="chart-title">Rendered vs Culled Objects <span class="chart-unit">count</span></div>
        <div class="chart-wrap"><canvas id="ch-objs"></canvas></div>
      </div>

      <div class="chart-box">
        <div class="chart-title">Culling Efficiency <span class="chart-unit">%</span></div>
        <div class="chart-wrap"><canvas id="ch-eff"></canvas></div>
      </div>

      <div class="chart-box">
        <div class="chart-title">Frame Time Budget <span class="chart-unit">% of 16.67ms</span></div>
        <div class="chart-wrap"><canvas id="ch-budget"></canvas></div>
      </div>

    </div><!-- /perf-charts -->

    <!-- Active Method Tags -->
    <div class="perf-footer">
      <span class="foot-label">Active Methods:</span>
      <span class="method-tag" id="mtag-frustum">Frustum</span>
      <span class="method-tag" id="mtag-octree">Octree</span>
      <span class="method-tag" id="mtag-occlusion">Occlusion</span>
      <span class="method-tag" id="mtag-lod">LOD</span>
    </div>

  </div><!-- /perf-panel -->
</div><!-- /perf-overlay -->
`;
}

// ============================================================
// ChartPanel class
// ============================================================
export class ChartPanel {
    constructor() {
        this.visible  = false;
        this.charts   = {};
        this._csvRows = []; // Untuk export CSV
        this._injected = false;
    }

    // Inject DOM dan inisialisasi chart
    init() {
        if (this._injected) return;
        document.body.insertAdjacentHTML('beforeend', buildPanelHTML());
        this._injected = true;
        this._injectStyles();
        this._buildCharts();
        this._bindButtons();
    }

    toggle() {
        if (!this._injected) this.init();
        const el = document.getElementById('perf-overlay');
        if (!el) return;
        this.visible = !this.visible;
        el.classList.toggle('perf-visible', this.visible);
        if (this.visible) this._refreshAll();
    }

    close() {
        this.visible = false;
        const el = document.getElementById('perf-overlay');
        if (el) el.classList.remove('perf-visible');
    }

    // Dipanggil dari main.js setiap update stats (500ms)
    update(perfMonitor, activeState) {
        if (!this._injected) return;

        const { history, snapshot } = perfMonitor.getChartData();

        // Update summary cards
        this._card('fps',  history.fps.avg().toFixed(0),
            `min ${history.fps.min()} / max ${history.fps.max()}`);
        this._card('cpu',  history.cpuFrameMs.avg().toFixed(2) + ' ms',
            `min ${history.cpuFrameMs.min()} / max ${history.cpuFrameMs.max().toFixed(2)}`);

        if (snapshot.gpuSupported && snapshot.gpuFrameMs > 0) {
            this._card('gpu', history.gpuFrameMs.avg().toFixed(2) + ' ms',
                `min ${history.gpuFrameMs.min().toFixed(2)} / max ${history.gpuFrameMs.max().toFixed(2)}`);
            const badge = document.getElementById('gpu-badge');
            if (badge) { badge.textContent = 'supported'; badge.style.background = 'rgba(0,255,136,0.2)'; badge.style.color = '#00ff88'; }
        } else {
            this._card('gpu', snapshot.gpuSupported ? '—' : 'N/A', snapshot.gpuSupported ? 'querying…' : 'not supported');
        }

        const heapSub = snapshot.heapLimit > 0 ? `limit ${snapshot.heapLimit} MB` : 'unavailable';
        this._card('mem', snapshot.heapMB > 0 ? snapshot.heapMB.toFixed(1) + ' MB' : 'N/A', heapSub);
        this._card('dc',  snapshot.drawCalls.toString(), 'per frame');
        this._card('eff', snapshot.cullEff + '%', `${snapshot.culledTotal.toLocaleString()} culled`);

        // Update method tags
        this._tag('mtag-frustum',  activeState.useFrustum);
        this._tag('mtag-octree',   activeState.useOctree);
        this._tag('mtag-occlusion',activeState.useOcclusion);
        this._tag('mtag-lod',      activeState.useLOD);

        // Accumulate CSV row
        this._csvRows.push({
            ts: Date.now(),
            fps: snapshot.fps,
            cpuMs: snapshot.cpuFrameMs,
            gpuMs: snapshot.gpuFrameMs,
            heapMB: snapshot.heapMB,
            drawCalls: snapshot.drawCalls,
            rendered: snapshot.rendered,
            culled: snapshot.culledTotal,
            cullEff: snapshot.cullEff,
            budget: snapshot.frameTimeBudget,
        });
        if (this._csvRows.length > 5000) this._csvRows.shift(); // limit 5000 rows

        if (!this.visible) return; // Jangan update chart kalau panel tersembunyi

        this._pushChart('fps',    history.fps.get());
        this._pushChart('cpu',    history.cpuFrameMs.get());
        this._pushChart('gpu',    history.gpuFrameMs.get());
        this._pushChart('mem',    history.heapMB.get());
        this._pushChart('eff',    history.cullEff.get());
        this._pushChart('budget', history.frameTimeBudget.get());

        // Rendered vs Culled dual chart
        const r = history.rendered.get();
        const c = history.culledTotal.get();
        const labLen = Math.max(r.length, c.length);
        const labels = Array.from({length: labLen}, (_, i) => `${i}`);
        if (this.charts.objs) {
            this.charts.objs.data.labels = labels;
            this.charts.objs.data.datasets[0].data = r;
            this.charts.objs.data.datasets[1].data = c;
            this.charts.objs.update('none');
        }
    }

    // ──────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────

    _card(id, val, sub) {
        const v = document.getElementById(`cval-${id}`);
        const s = document.getElementById(`csub-${id}`);
        if (v) v.textContent = val;
        if (s) s.textContent = sub;
    }

    _tag(id, active) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('active', active);
    }

    _pushChart(key, data) {
        const ch = this.charts[key];
        if (!ch) return;
        const labels = Array.from({length: data.length}, (_, i) => `${i}`);
        ch.data.labels = labels;
        ch.data.datasets[0].data = data;
        ch.update('none'); // 'none' = no animation (performance!)
    }

    _refreshAll() {
        Object.values(this.charts).forEach(ch => ch.update('none'));
    }

    _buildCharts() {
        const makeOpts = (yLabel, min, max, refLine) => {
            const opts = JSON.parse(JSON.stringify(CHART_DEFAULTS));
            opts.scales.y.title = { display: true, text: yLabel, color: '#5a7080', font: { size: 9 } };
            if (min !== undefined) opts.scales.y.min = min;
            if (max !== undefined) opts.scales.y.suggestedMax = max;
            if (refLine) {
                opts.plugins.annotation = {
                    annotations: {
                        ref: {
                            type: 'line', yMin: refLine, yMax: refLine,
                            borderColor: 'rgba(255,100,100,0.4)',
                            borderDash: [4,4], borderWidth: 1,
                        }
                    }
                };
            }
            return opts;
        };

        this.charts.fps    = this._makeChart('ch-fps',    [makeDataset('FPS', CHART_COLOR.fps)],       makeOpts('fps', 0, 120));
        this.charts.cpu    = this._makeChart('ch-cpu',    [makeDataset('CPU ms', CHART_COLOR.cpu)],     makeOpts('ms',  0, 50, 16.67));
        this.charts.gpu    = this._makeChart('ch-gpu',    [makeDataset('GPU ms', CHART_COLOR.gpu)],     makeOpts('ms',  0, 50));
        this.charts.mem    = this._makeChart('ch-mem',    [makeDataset('MB', CHART_COLOR.mem)],         makeOpts('MB',  0));
        this.charts.eff    = this._makeChart('ch-eff',    [makeDataset('%',  CHART_COLOR.eff)],         makeOpts('%',   0, 100));
        this.charts.budget = this._makeChart('ch-budget', [makeDataset('%',  CHART_COLOR.budget)],      makeOpts('%',   0, 150, 100));

        // Dual line chart: rendered + culled
        this.charts.objs = this._makeChart('ch-objs', [
            makeDataset('Rendered', CHART_COLOR.render),
            makeDataset('Culled',   CHART_COLOR.culled),
        ], makeOpts('objects', 0));
        // Enable legend for dual chart
        this.charts.objs.options.plugins.legend.display = true;
        this.charts.objs.options.plugins.legend.labels  = {
            color: '#c8d8e8', font: { family: 'Share Tech Mono', size: 10 },
            boxWidth: 12, padding: 12,
        };
        this.charts.objs.update('none');
    }

    _makeChart(canvasId, datasets, options) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        return new Chart(canvas, { type: 'line', data: { labels: [], datasets }, options });
    }

    _bindButtons() {
        document.getElementById('perf-close')?.addEventListener('click', () => this.close());
        document.getElementById('perf-clear')?.addEventListener('click', () => {
            this._csvRows = [];
            Object.values(this.charts).forEach(ch => {
                ch.data.labels = [];
                ch.data.datasets.forEach(ds => ds.data = []);
                ch.update('none');
            });
        });
        document.getElementById('perf-export-csv')?.addEventListener('click', () => this._exportCSV());
        // Export JSON — reuse same row data but output as JSON
        document.getElementById('perf-export-json')?.addEventListener('click', () => this._exportJSON());
    }

    _exportCSV() {
        if (!this._csvRows.length) { alert('Belum ada data yang direkam.'); return; }
        const header = 'timestamp,fps,cpu_ms,gpu_ms,heap_mb,draw_calls,rendered,culled,cull_eff_%,frame_budget_%\n';
        const rows = this._csvRows.map(r =>
            `${r.ts},${r.fps},${r.cpuMs},${r.gpuMs},${r.heapMB},${r.drawCalls},${r.rendered},${r.culled},${r.cullEff},${r.budget}`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `perf_data_${Date.now()}.csv`;
        a.click();
    }

    _exportJSON() {
        if (!this._csvRows.length) { alert('Belum ada data yang direkam.'); return; }
        // Ambil snapshot terbaru (row terakhir)
        const latest = this._csvRows[this._csvRows.length - 1];
        const allRows = this._csvRows.map(r => ({
            timestamp:        r.ts,
            fps:              r.fps,
            frameTime:        r.cpuMs,
            gpuFrameTime:     r.gpuMs,
            heapMemoryMB:     r.heapMB,
            drawCalls:        r.drawCalls,
            renderedObjects:  r.rendered,
            culledObjects:    r.culled,
            cullingEfficiency: r.cullEff + '%',
            frameBudgetPct:   r.budget,
        }));
        const output = {
            exportedAt:   new Date().toISOString(),
            totalSamples: allRows.length,
            summary: {
                fps:              latest.fps,
                frameTime:        latest.cpuMs,
                gpuFrameTime:     latest.gpuMs,
                heapMemoryMB:     latest.heapMB,
                drawCalls:        latest.drawCalls,
                renderedObjects:  latest.rendered,
                culledObjects:    latest.culled,
                cullingEfficiency: latest.cullEff + '%',
            },
            samples: allRows,
        };
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `perf_data_${Date.now()}.json`;
        a.click();
    }

    // ──────────────────────────────────────────────────────
    // Styles (injected once)
    // ──────────────────────────────────────────────────────
    _injectStyles() {
        const css = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&display=swap');

#perf-overlay {
    position: fixed; inset: 0;
    z-index: 200;
    background: rgba(2,3,12,0.88);
    backdrop-filter: blur(6px);
    display: none;
    align-items: center; justify-content: center;
    padding: 16px;
}
#perf-overlay.perf-visible {
    display: flex;
}

#perf-panel {
    width: 100%; max-width: 1100px; max-height: 90vh;
    background: rgba(6,10,28,0.98);
    border: 1px solid rgba(0,200,255,0.2);
    border-radius: 14px;
    overflow-y: auto;
    box-shadow: 0 0 60px rgba(0,200,255,0.08), 0 0 120px rgba(123,47,255,0.06);
    font-family: 'Exo 2', sans-serif;
    color: #c8d8e8;
}

#perf-panel::-webkit-scrollbar { width: 4px; }
#perf-panel::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.3); border-radius: 4px; }

.perf-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(0,200,255,0.12);
    background: linear-gradient(90deg, rgba(0,200,255,0.06), rgba(123,47,255,0.06));
    position: sticky; top: 0; z-index: 2;
    backdrop-filter: blur(8px);
}

.perf-title {
    font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; color: #00c8ff;
    display: flex; align-items: center; gap: 10px;
}

.perf-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #00ff88; box-shadow: 0 0 8px #00ff88;
    animation: blink 2s infinite;
}

.perf-header-right { display: flex; gap: 8px; align-items: center; }

.perf-btn {
    padding: 5px 12px;
    background: rgba(0,200,255,0.08); border: 1px solid rgba(0,200,255,0.25);
    border-radius: 5px; color: #00c8ff; font-size: 0.68rem;
    font-family: 'Share Tech Mono', monospace; letter-spacing: 0.06em;
    cursor: pointer; transition: 0.15s;
}
.perf-btn:hover { background: rgba(0,200,255,0.18); }

.perf-btn-json {
    background: rgba(0,255,136,0.08);
    border-color: rgba(0,255,136,0.3);
    color: #00ff88;
}
.perf-btn-json:hover { background: rgba(0,255,136,0.2); }

.perf-close {
    padding: 5px 10px;
    background: rgba(255,68,85,0.1); border: 1px solid rgba(255,68,85,0.3);
    border-radius: 5px; color: #ff4455; font-size: 0.75rem;
    cursor: pointer; transition: 0.15s;
}
.perf-close:hover { background: rgba(255,68,85,0.25); }

/* Summary Cards */
.perf-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1px;
    border-bottom: 1px solid rgba(0,200,255,0.1);
    background: rgba(0,200,255,0.06);
}

.perf-card {
    background: rgba(6,10,28,0.95);
    padding: 14px 16px;
    display: flex; align-items: center; gap: 12px;
    transition: background 0.2s;
}
.perf-card:hover { background: rgba(0,200,255,0.04); }

.card-icon { font-size: 1.4rem; opacity: 0.7; }

.card-val {
    font-family: 'Share Tech Mono', monospace;
    font-size: 1.3rem; color: #00c8ff; line-height: 1;
    margin-bottom: 3px;
}

.card-lbl {
    font-size: 0.62rem; text-transform: uppercase;
    letter-spacing: 0.1em; color: #5a7080;
}

.card-sub {
    font-size: 0.58rem; color: #3a5060;
    font-family: 'Share Tech Mono', monospace;
    margin-top: 2px;
}

/* Charts Grid */
.perf-charts {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto;
    gap: 1px;
    background: rgba(0,200,255,0.06);
    padding: 1px;
}

@media (max-width: 900px) {
    .perf-charts { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 600px) {
    .perf-charts { grid-template-columns: 1fr; }
}

.chart-box {
    background: rgba(6,10,28,0.95);
    padding: 14px 16px;
}

.chart-wide {
    grid-column: span 2;
}

.chart-title {
    font-size: 0.65rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: #5a7080; margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
}

.chart-unit { color: #3a5060; font-weight: 400; }
.chart-ref  { color: rgba(255,100,100,0.5); font-size: 0.58rem; }

.chart-badge {
    font-size: 0.55rem; padding: 2px 7px;
    background: rgba(255,68,85,0.15);
    color: #ff4455; border-radius: 3px;
    border: 1px solid rgba(255,68,85,0.3);
}

.chart-wrap { height: 110px; position: relative; }

/* Footer / method tags */
.perf-footer {
    padding: 12px 20px;
    border-top: 1px solid rgba(0,200,255,0.1);
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
}

.foot-label {
    font-size: 0.6rem; text-transform: uppercase;
    letter-spacing: 0.12em; color: #3a5060;
    margin-right: 4px;
}

.method-tag {
    font-size: 0.62rem; padding: 3px 10px;
    border-radius: 4px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #3a5060;
    font-family: 'Share Tech Mono', monospace;
    transition: 0.2s;
}
.method-tag.active {
    background: rgba(0,200,255,0.12);
    border-color: rgba(0,200,255,0.4);
    color: #00c8ff;
    box-shadow: 0 0 8px rgba(0,200,255,0.15);
}

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
}
