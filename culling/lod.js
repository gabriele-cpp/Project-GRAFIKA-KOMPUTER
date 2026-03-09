export class LOD {
    constructor() {
        // Threshold jarak untuk setiap level — bisa diubah lewat UI
        this.nearThreshold   = 150;   // < 150  = full detail
        this.midThreshold    = 350;   // < 350  = medium detail
        this.farThreshold    = 600;   // < 600  = low detail, >= 600 = cull

        this.enabled = false;
    }

    /**
     * Hitung level LOD dan scale untuk sebuah objek.
     * @param {number} dist  — Jarak dari kamera ke objek
     * @returns {{ level: number, scale: number, shouldRender: boolean }}
     */
    getLevel(dist) {
        if (!this.enabled) {
            return { level: 0, scale: 1.0, shouldRender: true };
        }

        if (dist < this.nearThreshold) {
            return { level: 0, scale: 1.0,  shouldRender: true };
        } else if (dist < this.midThreshold) {
            return { level: 1, scale: 0.85, shouldRender: true };
        } else if (dist < this.farThreshold) {
            return { level: 2, scale: 0.55, shouldRender: true };
        } else {
            return { level: 3, scale: 0.0,  shouldRender: false };
        }
    }

    /**
     * Hitung jarak Euclidean antara posisi objek dan kamera.
     */
    getDistance(objPos, camPos) {
        return Math.hypot(
            objPos[0] - camPos[0],
            objPos[1] - camPos[1],
            objPos[2] - camPos[2]
        );
    }
}
