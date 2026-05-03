const DEFAULT_TECHNIQUES = [
    {
        key: 'baseline',
        label: 'No Optimization',
        state: {
            useFrustum: false,
            useOctree: false,
            useOcclusion: false,
            useLOD: false,
            useTemporalCoherence: false,
            usePredictiveCulling: false,
        },
    },
    {
        key: 'frustum',
        label: 'Frustum Only',
        state: {
            useFrustum: true,
            useOctree: false,
            useOcclusion: false,
            useLOD: false,
            useTemporalCoherence: false,
            usePredictiveCulling: false,
        },
    },
    {
        key: 'occlusion',
        label: 'Occlusion Only',
        state: {
            useFrustum: false,
            useOctree: false,
            useOcclusion: true,
            useLOD: false,
            useTemporalCoherence: false,
            usePredictiveCulling: false,
        },
    },
    {
        key: 'lod',
        label: 'LOD Only',
        state: {
            useFrustum: false,
            useOctree: false,
            useOcclusion: false,
            useLOD: true,
            useTemporalCoherence: false,
            usePredictiveCulling: false,
        },
    },
    {
        key: 'hybrid',
        label: 'Hybrid',
        state: {
            useFrustum: true,
            useOctree: true,
            useOcclusion: true,
            useLOD: true,
            useTemporalCoherence: false,
            usePredictiveCulling: false,
        },
    },
    {
        key: 'hybrid2',
        label: 'Hybrid 2.0',
        state: {
            useFrustum: true,
            useOctree: true,
            useOcclusion: true,
            useLOD: true,
            useTemporalCoherence: true,
            usePredictiveCulling: true,
        },
    },
];

function percentile(values, ratio) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1));
    return sorted[index];
}

function toCsvRow(sample) {
    return [
        sample.technique,
        sample.frameIndex,
        sample.elapsedMs,
        sample.fps,
        sample.cpuFrameMs,
        sample.gpuFrameMs,
        sample.drawCalls,
        sample.vertexCount,
        sample.rendered,
        sample.culled,
        sample.cullEfficiency,
        sample.octreeDepth,
        sample.stageSpatialMs,
        sample.stagePredictiveMs,
        sample.stageOcclusionMs,
        sample.stageLodMs,
        sample.reusedVisibility,
        sample.predictedVisible,
        sample.isWarmup ? 1 : 0,
    ].join(',');
}

export class BenchmarkRunner {
    constructor() {
        this.active = false;
        this.completed = false;
        this.techniques = DEFAULT_TECHNIQUES;
        this.currentIndex = -1;
        this.currentTechnique = null;
        this.results = [];
        this.samples = [];
        this.allSamples = [];
        this.label = 'benchmark';
        this.sceneLabel = 'scene';
        this.sceneSeed = null;
        this.warmupFrames = 30;
        this.pathMeta = null;
    }

    start(path, options = {}) {
        if (!path?.samples?.length) throw new Error('Camera path belum tersedia untuk benchmark.');
        this.path = path;
        this.label = options.label || 'benchmark';
        this.sceneLabel = options.sceneLabel || 'scene';
        this.sceneSeed = Number.isFinite(options.sceneSeed) ? options.sceneSeed : null;
        this.warmupFrames = Math.max(0, Math.min(300, Number.parseInt(options.warmupFrames, 10) || 30));
        this.pathMeta = {
            label: path.label || 'path',
            sampleCount: path.samples.length,
            durationMs: path.durationMs || path.samples.at(-1)?.time || 0,
            options: path.options || null,
        };
        this.techniques = options.techniques || DEFAULT_TECHNIQUES;
        this.results = [];
        this.samples = [];
        this.allSamples = [];
        this.currentIndex = -1;
        this.currentTechnique = null;
        this.active = true;
        this.completed = false;
        return this.nextTechnique();
    }

    nextTechnique() {
        if (!this.active) return null;
        this.currentIndex++;
        if (this.currentIndex >= this.techniques.length) {
            this.active = false;
            this.completed = true;
            this.currentTechnique = null;
            return null;
        }

        const technique = this.techniques[this.currentIndex];
        this.currentTechnique = {
            ...technique,
            frameCursor: 0,
            warmupFrames: Number.isFinite(technique.warmupFrames)
                ? Math.max(0, Math.floor(technique.warmupFrames))
                : this.warmupFrames,
            warmup: [],
            frames: [],
            startedAt: performance.now(),
        };
        return this.currentTechnique;
    }

    captureFrame(sample) {
        if (!this.active || !this.currentTechnique) return;
        const frameIndex = this.currentTechnique.frameCursor++;
        const warmupLimit = this.currentTechnique.warmupFrames || 0;
        const frameSample = {
            technique: this.currentTechnique.label,
            ...sample,
            frameIndex,
            isWarmup: frameIndex < warmupLimit,
        };
        this.allSamples.push(frameSample);

        if (frameSample.isWarmup) {
            this.currentTechnique.warmup.push(frameSample);
            return;
        }

        const measuredFrame = {
            ...frameSample,
            measuredFrameIndex: frameIndex - warmupLimit,
        };
        this.currentTechnique.frames.push(measuredFrame);
        this.samples.push(measuredFrame);
    }

    finalizeCurrentTechnique() {
        if (!this.currentTechnique) return null;
        const frames = this.currentTechnique.frames.length
            ? this.currentTechnique.frames
            : this.currentTechnique.warmup;
        const avg = key => frames.length
            ? frames.reduce((sum, frame) => sum + (Number(frame[key]) || 0), 0) / frames.length
            : 0;

        const cpuSeries = frames.map(frame => Number(frame.cpuFrameMs) || 0);
        const gpuSeries = frames.map(frame => Number(frame.gpuFrameMs) || 0);
        const fpsSeries = frames.map(frame => Number(frame.fps) || 0);

        const result = {
            key: this.currentTechnique.key,
            label: this.currentTechnique.label,
            frameCount: this.currentTechnique.frames.length,
            warmupFrameCount: this.currentTechnique.warmup.length,
            avgFps: Number(avg('fps').toFixed(2)),
            avgCpuFrameMs: Number(avg('cpuFrameMs').toFixed(2)),
            avgGpuFrameMs: Number(avg('gpuFrameMs').toFixed(2)),
            p95CpuFrameMs: Number(percentile(cpuSeries, 0.95).toFixed(2)),
            p99CpuFrameMs: Number(percentile(cpuSeries, 0.99).toFixed(2)),
            p95GpuFrameMs: Number(percentile(gpuSeries, 0.95).toFixed(2)),
            p99GpuFrameMs: Number(percentile(gpuSeries, 0.99).toFixed(2)),
            p05Fps: Number(percentile(fpsSeries, 0.05).toFixed(2)),
            avgDrawCalls: Number(avg('drawCalls').toFixed(2)),
            avgRendered: Number(avg('rendered').toFixed(2)),
            avgCulled: Number(avg('culled').toFixed(2)),
            avgCullEfficiency: Number(avg('cullEfficiency').toFixed(2)),
            avgVertexCount: Number(avg('vertexCount').toFixed(2)),
            avgSpatialMs: Number(avg('stageSpatialMs').toFixed(3)),
            avgPredictiveMs: Number(avg('stagePredictiveMs').toFixed(3)),
            avgOcclusionMs: Number(avg('stageOcclusionMs').toFixed(3)),
            avgLodMs: Number(avg('stageLodMs').toFixed(3)),
            avgReusedVisibility: Number(avg('reusedVisibility').toFixed(2)),
            avgPredictedVisible: Number(avg('predictedVisible').toFixed(2)),
        };
        this.results.push(result);
        this.currentTechnique = null;
        return result;
    }

    exportJSON() {
        return JSON.stringify({
            label: this.label,
            sceneLabel: this.sceneLabel,
            sceneSeed: this.sceneSeed,
            warmupFrames: this.warmupFrames,
            generatedAt: new Date().toISOString(),
            path: this.pathMeta,
            techniques: this.results,
            frames: this.samples,
            allFrames: this.allSamples,
        }, null, 2);
    }

    exportCSV() {
        const header = [
            'technique',
            'frame_index',
            'elapsed_ms',
            'fps',
            'cpu_frame_ms',
            'gpu_frame_ms',
            'draw_calls',
            'vertex_count',
            'rendered',
            'culled',
            'cull_efficiency',
            'octree_depth',
            'stage_spatial_ms',
            'stage_predictive_ms',
            'stage_occlusion_ms',
            'stage_lod_ms',
            'reused_visibility',
            'predicted_visible',
            'is_warmup',
        ].join(',');
        return [header, ...this.allSamples.map(toCsvRow)].join('\n');
    }

    getStatus() {
        return {
            active: this.active,
            completed: this.completed,
            label: this.label,
            sceneLabel: this.sceneLabel,
            currentTechnique: this.currentTechnique?.label || null,
            progress: this.techniques.length > 0
                ? Math.max(0, Math.min(1, (this.currentIndex + (this.currentTechnique ? 1 : 0)) / this.techniques.length))
                : 0,
            techniqueCount: this.techniques.length,
            completedCount: this.results.length,
            warmupFrames: this.warmupFrames,
            sceneSeed: this.sceneSeed,
        };
    }
}

export function getBenchmarkTechniques() {
    return DEFAULT_TECHNIQUES;
}
