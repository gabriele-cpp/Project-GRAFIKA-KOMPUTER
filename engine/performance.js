const HISTORY_SIZE = 120; // 120 sample = ~60 detik pada 2fps update

function makeRingBuffer(size) {
    const buf = new Array(size).fill(0);
    let head = 0;
    return {
        push(v) { buf[head % size] = v; head++; },
        get()   { 
            const out = [];
            const start = head >= size ? head - size : 0;
            for (let i = 0; i < Math.min(head, size); i++) {
                out.push(buf[(start + i) % size]);
            }
            return out;
        },
        latest() { return head > 0 ? buf[(head - 1) % size] : 0; },
        avg()    {
            const d = this.get();
            return d.length ? d.reduce((a,b)=>a+b,0)/d.length : 0;
        },
        max()    { return Math.max(...this.get(), 0); },
        min()    { const d = this.get(); return d.length ? Math.min(...d) : 0; },
    };
}

export class PerformanceMonitor {
    constructor(gl) {
        this.gl = gl;

        // Ring buffers untuk setiap metrik
        this.history = {
            fps:          makeRingBuffer(HISTORY_SIZE),
            cpuFrameMs:   makeRingBuffer(HISTORY_SIZE),
            gpuFrameMs:   makeRingBuffer(HISTORY_SIZE),
            heapMB:       makeRingBuffer(HISTORY_SIZE),
            drawCalls:    makeRingBuffer(HISTORY_SIZE),
            rendered:     makeRingBuffer(HISTORY_SIZE),
            culledTotal:  makeRingBuffer(HISTORY_SIZE),
            cullEff:      makeRingBuffer(HISTORY_SIZE),   // %
            frameTimeBudget: makeRingBuffer(HISTORY_SIZE), // % of 16.67ms used
        };

        // State per-frame (di-reset tiap frame)
        this._frameStart  = 0;
        this._frameCount  = 0;
        this._lastSecond  = performance.now();
        this._drawCallsThisFrame = 0;

        // GPU Timer Query (WebGL2 + EXT_disjoint_timer_query_webgl2)
        this._gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        this._gpuQuery    = null;
        this._gpuPending  = false;
        this._lastGpuMs   = 0;
        this._gpuSupported = !!this._gpuExt;

        // Snapshot untuk stats panel
        this.snapshot = {
            fps: 0, cpuFrameMs: 0, gpuFrameMs: 0,
            heapMB: 0, heapLimit: 0,
            drawCalls: 0, rendered: 0, culledTotal: 0,
            cullEff: 0, frameTimeBudget: 0,
            gpuSupported: this._gpuSupported,
        };
    }

    // Panggil di AWAL setiap frame
    beginFrame() {
        this._frameStart = performance.now();
        this._drawCallsThisFrame = 0;

        // Mulai GPU query jika didukung dan tidak ada query pending
        if (this._gpuSupported && !this._gpuPending) {
            this._gpuQuery = this.gl.createQuery();
            this.gl.beginQuery(this._gpuExt.TIME_ELAPSED_EXT, this._gpuQuery);
        }
    }

    // Panggil setelah setiap gl.drawElements / gl.drawArrays
    countDrawCall() {
        this._drawCallsThisFrame++;
    }

    // Panggil di AKHIR setiap frame, sebelum requestAnimationFrame
    endFrame(rendered, culledTotal, totalObjects) {
        const frameMs = performance.now() - this._frameStart;

        // Tutup GPU query
        if (this._gpuSupported && this._gpuQuery && !this._gpuPending) {
            this.gl.endQuery(this._gpuExt.TIME_ELAPSED_EXT);
            this._gpuPending = true;
        }

        // Cek hasil GPU query dari frame sebelumnya
        if (this._gpuSupported && this._gpuPending && this._gpuQuery) {
            const available = this.gl.getQueryParameter(
                this._gpuQuery, this.gl.QUERY_RESULT_AVAILABLE
            );
            const disjoint = this.gl.getParameter(this._gpuExt.GPU_DISJOINT_EXT);
            if (available && !disjoint) {
                const ns = this.gl.getQueryParameter(this._gpuQuery, this.gl.QUERY_RESULT);
                this._lastGpuMs = ns / 1e6; // nanoseconds → milliseconds
                this.gl.deleteQuery(this._gpuQuery);
                this._gpuQuery   = null;
                this._gpuPending = false;
            }
        }

        // Memory
        let heapMB = 0, heapLimit = 0;
        if (performance.memory) {
            heapMB    = performance.memory.usedJSHeapSize  / 1048576;
            heapLimit = performance.memory.jsHeapSizeLimit / 1048576;
        }

        // FPS setiap 500ms
        this._frameCount++;
        const now = performance.now();
        const elapsed = now - this._lastSecond;
        if (elapsed >= 500) {
            const fps = Math.round(this._frameCount / (elapsed / 1000));
            this._frameCount = 0;
            this._lastSecond = now;
            this.history.fps.push(fps);
            this.snapshot.fps = fps;
        }

        const cullEff = totalObjects > 0
            ? Math.round((culledTotal / totalObjects) * 100) : 0;
        const budget = Math.min((frameMs / 16.667) * 100, 200); // % of 60fps budget

        // Push ke history
        this.history.cpuFrameMs.push(parseFloat(frameMs.toFixed(2)));
        this.history.gpuFrameMs.push(parseFloat(this._lastGpuMs.toFixed(2)));
        this.history.heapMB.push(parseFloat(heapMB.toFixed(1)));
        this.history.drawCalls.push(this._drawCallsThisFrame);
        this.history.rendered.push(rendered);
        this.history.culledTotal.push(culledTotal);
        this.history.cullEff.push(cullEff);
        this.history.frameTimeBudget.push(parseFloat(budget.toFixed(1)));

        // Update snapshot
        Object.assign(this.snapshot, {
            cpuFrameMs:      parseFloat(frameMs.toFixed(2)),
            gpuFrameMs:      parseFloat(this._lastGpuMs.toFixed(2)),
            heapMB:          parseFloat(heapMB.toFixed(1)),
            heapLimit:       parseFloat(heapLimit.toFixed(0)),
            drawCalls:       this._drawCallsThisFrame,
            rendered,
            culledTotal,
            cullEff,
            frameTimeBudget: parseFloat(budget.toFixed(1)),
        });
    }

    // Ambil data lengkap untuk chart
    getChartData() {
        const len    = this.history.fps.get().length;
        const labels = Array.from({ length: len }, (_, i) => `${i}`);
        return { labels, history: this.history, snapshot: this.snapshot };
    }
}
