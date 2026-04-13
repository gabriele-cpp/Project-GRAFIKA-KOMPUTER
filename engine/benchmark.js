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
        this.label = 'benchmark';
        this.sceneLabel = 'scene';
    }

    start(path, options = {}) {
        if (!path?.samples?.length) throw new Error('Camera path belum tersedia untuk benchmark.');
        this.path = path;
        this.label = options.label || 'benchmark';
        this.sceneLabel = options.sceneLabel || 'scene';
        this.techniques = options.techniques || DEFAULT_TECHNIQUES;
        this.results = [];
        this.samples = [];
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

        this.currentTechnique = {
            ...this.techniques[this.currentIndex],
            frames: [],
            startedAt: performance.now(),
        };
        return this.currentTechnique;
    }

    captureFrame(sample) {
        if (!this.active || !this.currentTechnique) return;
        const frameSample = {
            technique: this.currentTechnique.label,
            ...sample,
        };
        this.currentTechnique.frames.push(frameSample);
        this.samples.push(frameSample);
    }

    finalizeCurrentTechnique() {
        if (!this.currentTechnique) return null;
        const frames = this.currentTechnique.frames;
        const avg = key => frames.length
            ? frames.reduce((sum, frame) => sum + (Number(frame[key]) || 0), 0) / frames.length
            : 0;

        const result = {
            key: this.currentTechnique.key,
            label: this.currentTechnique.label,
            frameCount: frames.length,
            avgFps: Number(avg('fps').toFixed(2)),
            avgCpuFrameMs: Number(avg('cpuFrameMs').toFixed(2)),
            avgGpuFrameMs: Number(avg('gpuFrameMs').toFixed(2)),
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
            generatedAt: new Date().toISOString(),
            techniques: this.results,
            frames: this.samples,
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
        ].join(',');
        return [header, ...this.samples.map(toCsvRow)].join('\n');
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
        };
    }
}

export function getBenchmarkTechniques() {
    return DEFAULT_TECHNIQUES;
}
