const HISTORY_SIZE = 120;

function makeRingBuffer(size) {
    const buffer = new Array(size).fill(0);
    let head = 0;
    return {
        push(value) {
            buffer[head % size] = value;
            head++;
        },
        get() {
            const length = Math.min(head, size);
            const offset = Math.max(0, head - size);
            const values = [];
            for (let index = 0; index < length; index++) {
                values.push(buffer[(offset + index) % size]);
            }
            return values;
        },
        avg() {
            const values = this.get();
            return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        },
        max() {
            return Math.max(...this.get(), 0);
        },
        min() {
            const values = this.get();
            return values.length ? Math.min(...values) : 0;
        },
    };
}

function getTimerSupport(gl) {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (isWebGL2) {
        const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        return extension ? { extension, webgl2: true } : null;
    }
    const extension = gl.getExtension('EXT_disjoint_timer_query');
    return extension ? { extension, webgl2: false } : null;
}

export class PerformanceMonitor {
    constructor(gl) {
        this.gl = gl;
        this.history = {
            fps: makeRingBuffer(HISTORY_SIZE),
            cpuFrameMs: makeRingBuffer(HISTORY_SIZE),
            gpuFrameMs: makeRingBuffer(HISTORY_SIZE),
            heapMB: makeRingBuffer(HISTORY_SIZE),
            ramMB: makeRingBuffer(HISTORY_SIZE),
            drawCalls: makeRingBuffer(HISTORY_SIZE),
            rendered: makeRingBuffer(HISTORY_SIZE),
            culledTotal: makeRingBuffer(HISTORY_SIZE),
            cullEff: makeRingBuffer(HISTORY_SIZE),
            frameTimeBudget: makeRingBuffer(HISTORY_SIZE),
            vertexCount: makeRingBuffer(HISTORY_SIZE),
            octreeDepth: makeRingBuffer(HISTORY_SIZE),
        };

        this._frameStart = 0;
        this._frameCount = 0;
        this._lastFpsTick = performance.now();
        this._drawCallsThisFrame = 0;
        this._vertexCountThisFrame = 0;

        const timerSupport = getTimerSupport(gl);
        this._gpuSupport = timerSupport;
        this._gpuQuery = null;
        this._gpuPending = false;
        this._lastGpuMs = 0;
        this._memoryApiSupported = typeof performance.measureUserAgentSpecificMemory === 'function';
        this._memorySamplePending = false;
        this._lastMemorySampleAt = 0;
        this._memorySampleIntervalMs = 1000;
        this._deviceMemoryMB = typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number'
            ? Math.round(navigator.deviceMemory * 1024)
            : 0;
        this._lastRamMB = 0;
        this._lastRamLimitMB = this._deviceMemoryMB;
        this._lastRamSource = this._memoryApiSupported
            ? 'Checking'
            : (performance.memory ? 'JS heap fallback' : 'Unavailable');

        this.snapshot = {
            fps: 0,
            cpuFrameMs: 0,
            gpuFrameMs: 0,
            heapMB: 0,
            heapLimit: 0,
            ramMB: 0,
            ramLimitMB: this._deviceMemoryMB,
            ramSource: this._lastRamSource,
            drawCalls: 0,
            rendered: 0,
            culledTotal: 0,
            cullEff: 0,
            frameTimeBudget: 0,
            vertexCount: 0,
            octreeDepth: 0,
            stageStats: null,
            gpuSupported: !!timerSupport,
        };
    }

    _sampleRamUsage(heapMB, heapLimit) {
        if (heapMB > 0 && (!this._lastRamMB || this._lastRamSource !== 'Page memory')) {
            this._lastRamMB = Number(heapMB.toFixed(1));
            this._lastRamLimitMB = Number(heapLimit.toFixed(0));
            this._lastRamSource = 'JS heap fallback';
        }

        const now = performance.now();
        if (!this._memoryApiSupported || this._memorySamplePending || (now - this._lastMemorySampleAt) < this._memorySampleIntervalMs) {
            return;
        }

        this._memorySamplePending = true;
        this._lastMemorySampleAt = now;

        performance.measureUserAgentSpecificMemory()
            .then(result => {
                const ramMB = result?.bytes / 1048576;
                if (!Number.isFinite(ramMB)) return;
                this._lastRamMB = Number(ramMB.toFixed(1));
                this._lastRamLimitMB = this._deviceMemoryMB || Number(heapLimit.toFixed(0));
                this._lastRamSource = 'Page memory';
            })
            .catch(() => {
                if (heapMB <= 0) {
                    this._lastRamSource = 'Unavailable';
                    return;
                }
                this._lastRamMB = Number(heapMB.toFixed(1));
                this._lastRamLimitMB = Number(heapLimit.toFixed(0));
                this._lastRamSource = 'JS heap fallback';
            })
            .finally(() => {
                this._memorySamplePending = false;
            });
    }

    beginFrame() {
        this._frameStart = performance.now();
        this._drawCallsThisFrame = 0;
        this._vertexCountThisFrame = 0;

        if (this._gpuSupport && !this._gpuPending) {
            if (this._gpuSupport.webgl2) {
                this._gpuQuery = this.gl.createQuery();
                this.gl.beginQuery(this._gpuSupport.extension.TIME_ELAPSED_EXT, this._gpuQuery);
            } else {
                this._gpuQuery = this._gpuSupport.extension.createQueryEXT();
                this._gpuSupport.extension.beginQueryEXT(this._gpuSupport.extension.TIME_ELAPSED_EXT, this._gpuQuery);
            }
        }
    }

    countDrawCall(vertexCount = 0) {
        this._drawCallsThisFrame++;
        this._vertexCountThisFrame += Number(vertexCount) || 0;
    }

    endFrame(rendered, culledTotal, totalObjects, extra = {}) {
        const frameMs = performance.now() - this._frameStart;

        if (this._gpuSupport && this._gpuQuery && !this._gpuPending) {
            if (this._gpuSupport.webgl2) {
                this.gl.endQuery(this._gpuSupport.extension.TIME_ELAPSED_EXT);
            } else {
                this._gpuSupport.extension.endQueryEXT(this._gpuSupport.extension.TIME_ELAPSED_EXT);
            }
            this._gpuPending = true;
        }

        if (this._gpuSupport && this._gpuPending && this._gpuQuery) {
            const extension = this._gpuSupport.extension;
            const available = this._gpuSupport.webgl2
                ? this.gl.getQueryParameter(this._gpuQuery, this.gl.QUERY_RESULT_AVAILABLE)
                : extension.getQueryObjectEXT(this._gpuQuery, extension.QUERY_RESULT_AVAILABLE_EXT);
            const disjoint = this.gl.getParameter(extension.GPU_DISJOINT_EXT);

            if (available && !disjoint) {
                const nanoseconds = this._gpuSupport.webgl2
                    ? this.gl.getQueryParameter(this._gpuQuery, this.gl.QUERY_RESULT)
                    : extension.getQueryObjectEXT(this._gpuQuery, extension.QUERY_RESULT_EXT);
                this._lastGpuMs = nanoseconds / 1e6;
                if (this._gpuSupport.webgl2) this.gl.deleteQuery(this._gpuQuery);
                else extension.deleteQueryEXT(this._gpuQuery);
                this._gpuQuery = null;
                this._gpuPending = false;
            }
        }

        let heapMB = 0;
        let heapLimit = 0;
        if (performance.memory) {
            heapMB = performance.memory.usedJSHeapSize / 1048576;
            heapLimit = performance.memory.jsHeapSizeLimit / 1048576;
        }
        this._sampleRamUsage(heapMB, heapLimit);
        const ramMB = this._lastRamMB || heapMB;
        const ramLimitMB = this._lastRamLimitMB || Number(heapLimit.toFixed(0));

        this._frameCount++;
        const now = performance.now();
        const elapsed = now - this._lastFpsTick;
        if (elapsed >= 500) {
            const fps = Math.round(this._frameCount / (elapsed / 1000));
            this._frameCount = 0;
            this._lastFpsTick = now;
            this.history.fps.push(fps);
            this.snapshot.fps = fps;
        }

        const cullEff = totalObjects > 0 ? Math.round((culledTotal / totalObjects) * 100) : 0;
        const budget = Math.min((frameMs / 16.667) * 100, 200);
        const octreeDepth = Number(extra.octreeDepth) || 0;
        const vertexCount = Number(extra.vertexCount) || this._vertexCountThisFrame;

        this.history.cpuFrameMs.push(Number(frameMs.toFixed(2)));
        this.history.gpuFrameMs.push(Number(this._lastGpuMs.toFixed(2)));
        this.history.heapMB.push(Number(heapMB.toFixed(1)));
        this.history.ramMB.push(Number(ramMB.toFixed(1)));
        this.history.drawCalls.push(this._drawCallsThisFrame);
        this.history.rendered.push(rendered);
        this.history.culledTotal.push(culledTotal);
        this.history.cullEff.push(cullEff);
        this.history.frameTimeBudget.push(Number(budget.toFixed(1)));
        this.history.vertexCount.push(vertexCount);
        this.history.octreeDepth.push(octreeDepth);

        Object.assign(this.snapshot, {
            cpuFrameMs: Number(frameMs.toFixed(2)),
            gpuFrameMs: Number(this._lastGpuMs.toFixed(2)),
            heapMB: Number(heapMB.toFixed(1)),
            heapLimit: Number(heapLimit.toFixed(0)),
            ramMB: Number(ramMB.toFixed(1)),
            ramLimitMB: Number(ramLimitMB),
            ramSource: this._lastRamSource,
            drawCalls: this._drawCallsThisFrame,
            rendered,
            culledTotal,
            cullEff,
            frameTimeBudget: Number(budget.toFixed(1)),
            vertexCount,
            octreeDepth,
            stageStats: extra.stageStats || null,
        });
    }

    getChartData() {
        const length = this.history.fps.get().length;
        return {
            labels: Array.from({ length }, (_, index) => `${index}`),
            history: this.history,
            snapshot: this.snapshot,
        };
    }
}
