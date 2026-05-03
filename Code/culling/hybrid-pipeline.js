import { mat4 } from '../engine/math.js';

function distance(a, b) {
    return Math.hypot(
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    );
}

function createDecision(object) {
    return {
        object,
        visible: false,
        reason: 'frustum',
        distance: 0,
        lod: { level: 0, scale: 1.0, shouldRender: true, blend: 1.0 },
        predictedVisible: false,
        reusedVisibility: false,
    };
}

function predictVisibility(object, camera, lastCamera, history) {
    if (!lastCamera) return false;
    if (history?.visible) return true;

    const motion = [
        camera.position[0] - lastCamera.position[0],
        camera.position[1] - lastCamera.position[1],
        camera.position[2] - lastCamera.position[2],
    ];
    const motionLength = Math.hypot(motion[0], motion[1], motion[2]);
    if (motionLength < 0.01) return false;

    const toObject = [
        object.pos[0] - camera.position[0],
        object.pos[1] - camera.position[1],
        object.pos[2] - camera.position[2],
    ];
    const objectLength = Math.hypot(toObject[0], toObject[1], toObject[2]) || 1;
    const score = (motion[0] * toObject[0] + motion[1] * toObject[1] + motion[2] * toObject[2]) / (motionLength * objectLength);
    return score > 0.65;
}

export class HybridCullingPipeline {
    constructor({ frustum, octree, occlusion, lod }) {
        this.frustum = frustum;
        this.octree = octree;
        this.occlusion = occlusion;
        this.lod = lod;
        this.visibilityHistory = new Map();
        this.lastCamera = null;
        this.queryStats = {
            visitedNodes: 0,
            rejectedNodes: 0,
            acceptedLeafNodes: 0,
            maxDepthVisited: 0,
        };
        this.stageStats = {
            spatialMs: 0,
            predictiveMs: 0,
            occlusionMs: 0,
            lodMs: 0,
            candidateCount: 0,
            visibleCount: 0,
            frustumCulled: 0,
            occlusionCulled: 0,
            lodCulled: 0,
            reusedVisibility: 0,
            predictedVisible: 0,
            octreeDepth: 0,
        };
    }

    evaluate({ generatedObjects, importedObjects, state, camera }) {
        const sceneObjects = generatedObjects.concat(importedObjects);
        const decisions = new Map(sceneObjects.map(object => [object.id, createDecision(object)]));
        const viewProjection = mat4.create();
        mat4.multiply(viewProjection, camera.projectionMatrix, camera.viewMatrix);
        this.occlusion.beginFrame(camera, viewProjection);

        const spatialStart = performance.now();
        let generatedCandidates = generatedObjects;
        if (state.useFrustum && state.useOctree) {
            generatedCandidates = [];
            this.octree.queryFrustum(this.frustum, generatedCandidates, this.queryStats);
            generatedCandidates = generatedCandidates.filter(object => this._isInFrustum(object));
        } else if (state.useFrustum) {
            generatedCandidates = generatedObjects.filter(object => this._isInFrustum(object));
            this.queryStats.visitedNodes = this.octree.lastQueryStats?.visitedNodes || 0;
            this.queryStats.rejectedNodes = this.octree.lastQueryStats?.rejectedNodes || 0;
            this.queryStats.acceptedLeafNodes = this.octree.lastQueryStats?.acceptedLeafNodes || 0;
            this.queryStats.maxDepthVisited = this.octree.lastQueryStats?.maxDepthVisited || 0;
        }

        const importedCandidates = state.useFrustum
            ? importedObjects.filter(object => this._isInFrustum(object))
            : importedObjects.slice();

        let candidates = generatedCandidates.concat(importedCandidates);
        const frustumCulled = sceneObjects.length - candidates.length;
        this.stageStats.spatialMs = Number((performance.now() - spatialStart).toFixed(3));

        const predictiveStart = performance.now();
        // Selalu map distance + flags, lalu sort by distance ASC
        // (wajib agar occluder terdekat diregister ke depth grid lebih dulu)
        candidates = candidates.map(object => {
            const decision = decisions.get(object.id);
            decision.distance = distance(object.pos, camera.position);
            const history = this.visibilityHistory.get(object.id);
            decision.predictedVisible = state.usePredictiveCulling
                ? predictVisibility(object, camera, this.lastCamera, history)
                : false;
            decision.reusedVisibility = state.useTemporalCoherence && history?.visible && history.framesHidden < 2;
            return decision;
        });
        candidates.sort((a, b) => a.distance - b.distance);
        this.stageStats.predictiveMs = Number((performance.now() - predictiveStart).toFixed(3));

        // ── PASS 1: isi depth grid dari semua occluder ──
        // JANGAN filter dengan isFacingCamera di sini — dari view samping,
        // dot product ≈ 0 untuk semua objek → grid tidak pernah terisi → occlusion = 0
        if (state.useOcclusion) {
            for (const decision of candidates) {
                const obj = decision.object;
                if (!obj.isOccluder && !(obj.bounds && obj.bounds.radius > 4)) continue;
                this.occlusion.registerVisibleObject(obj.bounds, obj.isOccluder ? 1.5 : 1.0);
            }
        }

        // ── PASS 2: evaluasi visibility setiap kandidat ──
        const visible = [];
        let occlusionCulled = 0;
        let lodCulled = 0;
        let reusedVisibility = 0;
        let predictedVisible = 0;
        let occlusionTime = 0;
        let lodTime = 0;

        for (const decision of candidates) {
            const { object } = decision;
            if (decision.reusedVisibility) reusedVisibility++;
            if (decision.predictedVisible) predictedVisible++;

            if (state.useOcclusion && !(state.useTemporalCoherence && decision.reusedVisibility)) {
                const start = performance.now();
                const shouldRender = this.occlusion.shouldRender(object, decision.distance, camera.position, camera.forward);
                occlusionTime += performance.now() - start;
                if (!shouldRender) {
                    decision.reason = 'occlusion';
                    occlusionCulled++;
                    continue;
                }
            }

            const lodStart = performance.now();
            const lodResult = this.lod.getLevel(decision.distance * (object.lodWeight || 1));
            lodTime += performance.now() - lodStart;
            decision.lod = lodResult;
            if (state.useLOD && !lodResult.shouldRender) {
                decision.reason = 'lod';
                lodCulled++;
                continue;
            }

            decision.visible = true;
            decision.reason = decision.predictedVisible ? 'predicted' : decision.reusedVisibility ? 'temporal' : 'visible';
            visible.push(decision);
        }
        this.stageStats.occlusionMs = Number(occlusionTime.toFixed(3));
        this.stageStats.lodMs = Number(lodTime.toFixed(3));
        this.stageStats.candidateCount = candidates.length;
        this.stageStats.visibleCount = visible.length;
        this.stageStats.frustumCulled = frustumCulled;
        this.stageStats.occlusionCulled = occlusionCulled;
        this.stageStats.lodCulled = lodCulled;
        this.stageStats.reusedVisibility = reusedVisibility;
        this.stageStats.predictedVisible = predictedVisible;
        this.stageStats.octreeDepth = Math.max(this.queryStats.maxDepthVisited || 0, this.octree.stats.maxDepthReached || 0);

        for (const [id, decision] of decisions.entries()) {
            const history = this.visibilityHistory.get(id) || { visible: false, framesHidden: 0 };
            if (decision.visible) {
                this.visibilityHistory.set(id, { visible: true, framesHidden: 0 });
            } else {
                this.visibilityHistory.set(id, { visible: false, framesHidden: history.framesHidden + 1 });
            }
        }

        this.lastCamera = {
            position: [...camera.position],
            yaw: camera.yaw,
            pitch: camera.pitch,
        };

        return {
            decisions,
            visible,
            stageStats: { ...this.stageStats },
        };
    }

    _isInFrustum(object) {
        const bounds = object.bounds;
        return this.frustum.containsSphere(
            bounds.center[0],
            bounds.center[1],
            bounds.center[2],
            bounds.radius
        );
    }
}
