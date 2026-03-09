export class OcclusionCuller {
    constructor() {
        this.enabled = false;

        // Grid 2D kasar untuk mendeteksi "occluder" vs "occludee"
        // Resolusi grid yang lebih kecil = lebih cepat tapi kurang akurat
        this.gridResolution = 16;
        this.depthGrid = new Float32Array(this.gridResolution * this.gridResolution).fill(Infinity);
    }

    /**
     * Reset depth grid setiap frame sebelum culling dimulai
     */
    resetGrid() {
        this.depthGrid.fill(Infinity);
    }

    /**
     * Cek apakah objek berada di belakang kamera (back-face estimation)
     * @param {number[]} objPos   - Posisi objek [x, y, z]
     * @param {number[]} camPos   - Posisi kamera [x, y, z]
     * @param {number[]} camFwd   - Arah forward kamera (normalized)
     * @returns {boolean}        - true = terlihat, false = di belakang kamera
     */
    isFacingCamera(objPos, camPos, camFwd) {
        // Vektor dari kamera ke objek
        const toObj = [
            objPos[0] - camPos[0],
            objPos[1] - camPos[1],
            objPos[2] - camPos[2]
        ];
        // Kalau dot product positif, objek ada di depan kamera
        const dot = toObj[0]*camFwd[0] + toObj[1]*camFwd[1] + toObj[2]*camFwd[2];
        return dot > 0;
    }

    /**
     * Proximity occlusion: objek kecil yang "tersembunyi" di balik occluder besar
     * Menggunakan list occluders yang sudah dirender lebih dekat
     *
     * @param {number[]} objPos  - Posisi objek yang dicek
     * @param {number}   objDist - Jarak objek ke kamera
     * @param {Array}    occluders - Array objek yang sudah confirmed terlihat & lebih dekat
     * @param {number}   occludeRadius - Radius pengaruh occluder
     * @returns {boolean} - true = tidak di-occlude, false = occluded
     */
    isNotOccluded(objPos, objDist, occluders, occludeRadius = 8.0) {
        if (!this.enabled) return true;

        for (const occ of occluders) {
            if (occ.dist >= objDist) continue; // Occluder harus lebih dekat

            const dx = objPos[0] - occ.pos[0];
            const dy = objPos[1] - occ.pos[1];
            const dz = objPos[2] - occ.pos[2];
            const distToOccluder = Math.hypot(dx, dy, dz);

            // Jika objek sangat dekat dengan occluder DAN occluder lebih dekat ke kamera
            // → anggap objek ini tersembunyi
            if (distToOccluder < occludeRadius) {
                return false;
            }
        }
        return true;
    }

    /**
     * Main cull function — gabungan back-face + proximity occlusion
     * Ini adalah inti dari "Hybrid Spatial-Occlusion Culling"
     *
     * @param {number[]} objPos   - Posisi objek
     * @param {number}   objDist  - Jarak ke kamera
     * @param {number[]} camPos   - Posisi kamera
     * @param {number[]} camFwd   - Forward vector kamera
     * @param {Array}    occluders - List occluder yang sudah dirender
     * @returns {boolean} true = render objek ini, false = cull
     */
    shouldRender(objPos, objDist, camPos, camFwd, occluders) {
        if (!this.enabled) return true;

        // Step 1: Back-face cull — apakah di belakang kamera?
        if (!this.isFacingCamera(objPos, camPos, camFwd)) {
            return false;
        }

        // Step 2: Proximity occlusion
        if (!this.isNotOccluded(objPos, objDist, occluders)) {
            return false;
        }

        return true;
    }
}
