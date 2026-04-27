function clonePose(camera, time) {
    return {
        time,
        position: [...camera.position],
        yaw: camera.yaw,
        pitch: camera.pitch,
    };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function interpolatePose(a, b, time) {
    const span = Math.max(1, b.time - a.time);
    const t = Math.max(0, Math.min(1, (time - a.time) / span));
    return {
        position: [
            lerp(a.position[0], b.position[0], t),
            lerp(a.position[1], b.position[1], t),
            lerp(a.position[2], b.position[2], t),
        ],
        yaw: lerp(a.yaw, b.yaw, t),
        pitch: lerp(a.pitch, b.pitch, t),
    };
}

function smoothSamples(samples) {
    if (!Array.isArray(samples) || samples.length < 3) return samples.slice();
    const out = samples.map(sample => ({ ...sample, position: [...sample.position] }));
    for (let index = 1; index < samples.length - 1; index++) {
        const prev = samples[index - 1];
        const curr = samples[index];
        const next = samples[index + 1];
        out[index].position = [
            prev.position[0] * 0.25 + curr.position[0] * 0.5 + next.position[0] * 0.25,
            prev.position[1] * 0.25 + curr.position[1] * 0.5 + next.position[1] * 0.25,
            prev.position[2] * 0.25 + curr.position[2] * 0.5 + next.position[2] * 0.25,
        ];
        out[index].yaw = prev.yaw * 0.2 + curr.yaw * 0.6 + next.yaw * 0.2;
        out[index].pitch = prev.pitch * 0.2 + curr.pitch * 0.6 + next.pitch * 0.2;
    }
    return out;
}

function remapToConstantSpeed(samples, durationMs) {
    if (!Array.isArray(samples) || samples.length < 2) return samples.slice();
    const distances = [0];
    let totalDistance = 0;
    for (let index = 1; index < samples.length; index++) {
        const a = samples[index - 1].position;
        const b = samples[index].position;
        totalDistance += Math.hypot(
            b[0] - a[0],
            b[1] - a[1],
            b[2] - a[2]
        );
        distances.push(totalDistance);
    }
    if (totalDistance <= 0.001) return samples.slice();

    const safeDuration = Math.max(1, durationMs || samples.at(-1)?.time || 0);
    return samples.map((sample, index) => ({
        ...sample,
        position: [...sample.position],
        time: (distances[index] / totalDistance) * safeDuration,
    }));
}

function normalizeImportedPath(parsed) {
    const samples = parsed.samples.map(sample => ({
        time: Number(sample.time) || 0,
        position: [
            Number(sample.position?.[0]) || 0,
            Number(sample.position?.[1]) || 0,
            Number(sample.position?.[2]) || 0,
        ],
        yaw: Number(sample.yaw) || 0,
        pitch: Number(sample.pitch) || 0,
    }));
    return {
        version: parsed.version || 2,
        label: parsed.label || 'imported-path',
        durationMs: parsed.durationMs || samples.at(-1)?.time || 0,
        samples,
        options: {
            smoothing: !!parsed.options?.smoothing,
            constantSpeed: !!parsed.options?.constantSpeed,
        },
    };
}

export class CameraPathSystem {
    constructor() {
        this.recording = false;
        this.replaying = false;
        this.loop = false;
        this.sampleIntervalMs = 50;
        this.recordedPath = null;
        this.samples = [];
        this.label = 'path';
        this.replaySmoothing = true;
        this.replayConstantSpeed = true;
        this._recordStart = 0;
        this._replayStart = 0;
        this._lastSample = -Infinity;
        this._replayCursor = 0;
        this._replaySamples = [];
        this._replayDuration = 0;
        this._status = {
            mode: 'idle',
            sampleCount: 0,
            durationMs: 0,
            progress: 0,
            label: 'path',
            smoothing: this.replaySmoothing,
            constantSpeed: this.replayConstantSpeed,
        };
    }

    startRecording(label = 'path', now = performance.now()) {
        this.recording = true;
        this.replaying = false;
        this.samples = [];
        this.label = label;
        this._recordStart = now;
        this._lastSample = -Infinity;
        this._setStatus('recording', 0, 0, 0);
    }

    stopRecording(now = performance.now()) {
        if (!this.recording) return this.recordedPath;
        this.recording = false;
        const durationMs = Math.max(0, now - this._recordStart);
        this.recordedPath = {
            version: 2,
            label: this.label,
            durationMs,
            samples: this.samples.slice(),
            options: {
                smoothing: this.replaySmoothing,
                constantSpeed: this.replayConstantSpeed,
            },
        };
        this._setStatus('idle', this.samples.length, durationMs, 1);
        return this.recordedPath;
    }

    sample(camera, now = performance.now()) {
        if (!this.recording) return;
        if (now - this._lastSample < this.sampleIntervalMs && this.samples.length > 0) return;
        const time = now - this._recordStart;
        this.samples.push(clonePose(camera, time));
        this._lastSample = now;
        this._setStatus('recording', this.samples.length, time, 0);
    }

    startReplay(path = this.recordedPath, options = {}) {
        if (!path?.samples?.length) return false;
        this.recordedPath = path;
        this.replaying = true;
        this.recording = false;
        this.loop = !!options.loop;
        this.replaySmoothing = options.smoothing ?? this.recordedPath?.options?.smoothing ?? this.replaySmoothing;
        this.replayConstantSpeed = options.constantSpeed ?? this.recordedPath?.options?.constantSpeed ?? this.replayConstantSpeed;

        let replaySamples = this.recordedPath.samples.map(sample => ({ ...sample, position: [...sample.position] }));
        if (this.replaySmoothing) replaySamples = smoothSamples(replaySamples);

        const baseDuration = Math.max(this.recordedPath.durationMs || 0, replaySamples.at(-1)?.time || 0);
        if (this.replayConstantSpeed) replaySamples = remapToConstantSpeed(replaySamples, baseDuration);

        this._replaySamples = replaySamples;
        this._replayDuration = Math.max(baseDuration, replaySamples.at(-1)?.time || 0, 1);
        this._replayStart = performance.now();
        this._replayCursor = 0;
        this._setStatus('replaying', replaySamples.length, this._replayDuration, 0);
        return true;
    }

    stopReplay() {
        this.replaying = false;
        this._replayCursor = 0;
        this._replaySamples = [];
        this._replayDuration = 0;
        this._setStatus('idle', this.recordedPath?.samples?.length || 0, this.recordedPath?.durationMs || 0, 1);
    }

    update(camera, now = performance.now()) {
        if (!this.replaying || this._replaySamples.length === 0) return false;

        const elapsed = now - this._replayStart;
        const durationMs = Math.max(this._replayDuration, 1);

        if (elapsed >= durationMs) {
            if (this.loop && durationMs > 0) {
                this._replayStart = now;
                this._replayCursor = 0;
            } else {
                const last = this._replaySamples.at(-1);
                camera.position[0] = last.position[0];
                camera.position[1] = last.position[1];
                camera.position[2] = last.position[2];
                camera.yaw = last.yaw;
                camera.pitch = last.pitch;
                camera.updateViewMatrix();
                this.stopReplay();
                return false;
            }
        }

        const localElapsed = this.loop && durationMs > 0 ? (now - this._replayStart) % durationMs : now - this._replayStart;
        while (
            this._replayCursor < this._replaySamples.length - 2
            && this._replaySamples[this._replayCursor + 1].time < localElapsed
        ) {
            this._replayCursor++;
        }

        const current = this._replaySamples[this._replayCursor];
        const next = this._replaySamples[Math.min(this._replayCursor + 1, this._replaySamples.length - 1)];
        const pose = current === next ? current : interpolatePose(current, next, localElapsed);

        camera.position[0] = pose.position[0];
        camera.position[1] = pose.position[1];
        camera.position[2] = pose.position[2];
        camera.yaw = pose.yaw;
        camera.pitch = pose.pitch;
        camera.updateViewMatrix();

        const progress = durationMs > 0 ? Math.max(0, Math.min(1, localElapsed / durationMs)) : 0;
        this._setStatus('replaying', this._replaySamples.length, durationMs, progress);
        return true;
    }

    exportJSON() {
        return JSON.stringify(this.recordedPath || {
            version: 2,
            label: this.label,
            durationMs: 0,
            samples: [],
            options: {
                smoothing: this.replaySmoothing,
                constantSpeed: this.replayConstantSpeed,
            },
        }, null, 2);
    }

    importJSON(raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed?.samples || !Array.isArray(parsed.samples) || parsed.samples.length === 0) {
            throw new Error('Camera path JSON tidak valid.');
        }
        this.recordedPath = normalizeImportedPath(parsed);
        this.replaySmoothing = this.recordedPath.options.smoothing;
        this.replayConstantSpeed = this.recordedPath.options.constantSpeed;
        this._setStatus('idle', this.recordedPath.samples.length, this.recordedPath.durationMs, 1);
        return this.recordedPath;
    }

    getStatus() {
        return { ...this._status };
    }

    _setStatus(mode, sampleCount, durationMs, progress) {
        this._status = {
            mode,
            sampleCount,
            durationMs,
            progress,
            label: this.recordedPath?.label || this.label,
            smoothing: this.replaySmoothing,
            constantSpeed: this.replayConstantSpeed,
        };
    }
}
