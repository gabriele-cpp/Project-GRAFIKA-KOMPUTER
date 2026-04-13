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

export class CameraPathSystem {
    constructor() {
        this.recording = false;
        this.replaying = false;
        this.loop = false;
        this.sampleIntervalMs = 50;
        this.recordedPath = null;
        this.samples = [];
        this.label = 'path';
        this._recordStart = 0;
        this._replayStart = 0;
        this._lastSample = -Infinity;
        this._replayCursor = 0;
        this._status = {
            mode: 'idle',
            sampleCount: 0,
            durationMs: 0,
            progress: 0,
            label: 'path',
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
            version: 1,
            label: this.label,
            durationMs,
            samples: this.samples.slice(),
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
        this._replayStart = performance.now();
        this._replayCursor = 0;
        this._setStatus('replaying', path.samples.length, path.durationMs || 0, 0);
        return true;
    }

    stopReplay() {
        this.replaying = false;
        this._replayCursor = 0;
        this._setStatus('idle', this.recordedPath?.samples?.length || 0, this.recordedPath?.durationMs || 0, 1);
    }

    update(camera, now = performance.now()) {
        if (!this.replaying || !this.recordedPath?.samples?.length) return false;

        const elapsed = now - this._replayStart;
        const durationMs = Math.max(this.recordedPath.durationMs || 0, this.recordedPath.samples.at(-1)?.time || 0);

        if (elapsed >= durationMs) {
            if (this.loop && durationMs > 0) {
                this._replayStart = now;
                this._replayCursor = 0;
            } else {
                const last = this.recordedPath.samples.at(-1);
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
        const samples = this.recordedPath.samples;
        while (this._replayCursor < samples.length - 2 && samples[this._replayCursor + 1].time < localElapsed) {
            this._replayCursor++;
        }

        const current = samples[this._replayCursor];
        const next = samples[Math.min(this._replayCursor + 1, samples.length - 1)];
        const pose = current === next ? current : interpolatePose(current, next, localElapsed);

        camera.position[0] = pose.position[0];
        camera.position[1] = pose.position[1];
        camera.position[2] = pose.position[2];
        camera.yaw = pose.yaw;
        camera.pitch = pose.pitch;
        camera.updateViewMatrix();

        const progress = durationMs > 0 ? Math.max(0, Math.min(1, localElapsed / durationMs)) : 0;
        this._setStatus('replaying', samples.length, durationMs, progress);
        return true;
    }

    exportJSON() {
        return JSON.stringify(this.recordedPath || {
            version: 1,
            label: this.label,
            durationMs: 0,
            samples: [],
        }, null, 2);
    }

    importJSON(raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed?.samples || !Array.isArray(parsed.samples) || parsed.samples.length === 0) {
            throw new Error('Camera path JSON tidak valid.');
        }
        this.recordedPath = {
            version: parsed.version || 1,
            label: parsed.label || 'imported-path',
            durationMs: parsed.durationMs || parsed.samples.at(-1)?.time || 0,
            samples: parsed.samples.map(sample => ({
                time: Number(sample.time) || 0,
                position: [
                    Number(sample.position?.[0]) || 0,
                    Number(sample.position?.[1]) || 0,
                    Number(sample.position?.[2]) || 0,
                ],
                yaw: Number(sample.yaw) || 0,
                pitch: Number(sample.pitch) || 0,
            })),
        };
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
        };
    }
}
