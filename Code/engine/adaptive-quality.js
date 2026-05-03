const QUALITY_PROFILES = [
    {
        key: 'ultra',
        label: 'Ultra',
        lodDistanceScale: 1.15,
        occlusionGridResolution: 28,
        shadowQuality: 1.0,
        postProcessScale: 1.0,
    },
    {
        key: 'high',
        label: 'High',
        lodDistanceScale: 1.0,
        occlusionGridResolution: 24,
        shadowQuality: 0.85,
        postProcessScale: 0.9,
    },
    {
        key: 'balanced',
        label: 'Balanced',
        lodDistanceScale: 0.88,
        occlusionGridResolution: 20,
        shadowQuality: 0.65,
        postProcessScale: 0.75,
    },
    {
        key: 'performance',
        label: 'Performance',
        lodDistanceScale: 0.74,
        occlusionGridResolution: 16,
        shadowQuality: 0.45,
        postProcessScale: 0.6,
    },
];

export class AdaptiveQualityManager {
    constructor(targetFps = 60) {
        this.enabled = false;
        this.targetFps = targetFps;
        this.profileIndex = 1;
        this.sampleWindow = 24;
        this.cooldownFrames = 120;
        this._fpsSamples = [];
        this._cooldown = 0;
        this.lastAdjustment = 'Stable';
    }

    get profile() {
        return QUALITY_PROFILES[this.profileIndex];
    }

    update(snapshot, runtimeState, occlusion, lod) {
        if (!snapshot) return this.profile;
        if (this._cooldown > 0) this._cooldown--;

        const fps = Number(snapshot.fps) || 0;
        if (fps > 0) {
            this._fpsSamples.push(fps);
            if (this._fpsSamples.length > this.sampleWindow) this._fpsSamples.shift();
        }

        if (!this.enabled || this._fpsSamples.length < this.sampleWindow) {
            this.apply(runtimeState, occlusion, lod);
            return this.profile;
        }

        const averageFps = this._fpsSamples.reduce((sum, value) => sum + value, 0) / this._fpsSamples.length;
        const lowerBound = this.targetFps - 6;
        const upperBound = this.targetFps + 8;

        if (this._cooldown === 0 && averageFps < lowerBound && this.profileIndex < QUALITY_PROFILES.length - 1) {
            this.profileIndex++;
            this._cooldown = this.cooldownFrames;
            this.lastAdjustment = `Downshift -> ${this.profile.label}`;
        } else if (this._cooldown === 0 && averageFps > upperBound && this.profileIndex > 0) {
            this.profileIndex--;
            this._cooldown = this.cooldownFrames;
            this.lastAdjustment = `Upshift -> ${this.profile.label}`;
        } else if (this._cooldown === 0) {
            this.lastAdjustment = `Stable -> ${this.profile.label}`;
        }

        this.apply(runtimeState, occlusion, lod);
        runtimeState.budgetAverageFps = Number(averageFps.toFixed(1));
        return this.profile;
    }

    apply(runtimeState, occlusion, lod) {
        const profile = this.profile;
        runtimeState.qualityProfile = profile.key;
        runtimeState.shadowQuality = profile.shadowQuality;
        runtimeState.postProcessScale = profile.postProcessScale;
        runtimeState.dynamicLodDistanceScale = profile.lodDistanceScale;

        if (occlusion) occlusion.setResolution?.(profile.occlusionGridResolution);
        if (lod) lod.distanceScale = profile.lodDistanceScale;
    }
}
