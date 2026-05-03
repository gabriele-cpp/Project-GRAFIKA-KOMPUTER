export class LOD {
    constructor() {
        // Threshold disesuaikan ke skala voxel world (blockHalf=2.4, cellSize=4.8)
        // world ~120*4.8 = 576 unit. Kamera mulai di z=80.
        // nearThreshold 80 → mulai reduce di jarak 80 unit dari kamera
        // farThreshold 300 → cull total di jarak 300 unit
        this.nearThreshold = 80;
        this.midThreshold = 180;
        this.farThreshold = 300;
        this.enabled = false;
        this.distanceScale = 1.0;
        this.transitionBand = 45;
    }

    getLevel(dist) {
        const scaledDistance = dist / Math.max(0.25, this.distanceScale || 1.0);
        if (!this.enabled) {
            return { level: 0, scale: 1.0, shouldRender: true, blend: 1.0 };
        }

        if (scaledDistance < this.nearThreshold) {
            return { level: 0, scale: 1.0, shouldRender: true, blend: 1.0 };
        }
        if (scaledDistance < this.midThreshold) {
            return {
                level: 1,
                scale: this._smoothScale(scaledDistance, this.nearThreshold, this.midThreshold, 1.0, 0.84),
                shouldRender: true,
                blend: 1.0,
            };
        }
        if (scaledDistance < this.farThreshold) {
            return {
                level: 2,
                scale: this._smoothScale(scaledDistance, this.midThreshold, this.farThreshold, 0.84, 0.56),
                shouldRender: true,
                blend: 1.0,
            };
        }
        return { level: 3, scale: 0.0, shouldRender: false, blend: 0.0 };
    }

    getDistance(objPos, camPos) {
        return Math.hypot(
            objPos[0] - camPos[0],
            objPos[1] - camPos[1],
            objPos[2] - camPos[2]
        );
    }

    _smoothScale(distance, start, end, scaleStart, scaleEnd) {
        const bandStart = Math.max(start, end - this.transitionBand);
        if (distance <= bandStart) return scaleStart;
        const t = Math.max(0, Math.min(1, (distance - bandStart) / Math.max(1, end - bandStart)));
        const eased = t * t * (3 - 2 * t);
        return scaleStart + (scaleEnd - scaleStart) * eased;
    }
}
