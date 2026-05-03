function multiplyVec4(matrix, x, y, z, w = 1) {
    return [
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
        matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w,
    ];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class OcclusionCuller {
    constructor() {
        this.enabled = false;
        this.gridResolution = 32;
        this.depthGrid = new Float32Array(this.gridResolution * this.gridResolution);
        this.viewProjectionMatrix = null;
        this.cameraPosition = [0, 0, 0];
        this.cameraForward = [0, 0, -1];
        this.resetGrid();
    }

    setResolution(resolution) {
        const next = Math.max(8, Math.min(64, Number(resolution) || this.gridResolution));
        if (next === this.gridResolution) return;
        this.gridResolution = next;
        this.depthGrid = new Float32Array(this.gridResolution * this.gridResolution);
        this.resetGrid();
    }

    getDepthGridSnapshot() {
        return {
            resolution: this.gridResolution,
            values: Array.from(this.depthGrid),
        };
    }

    beginFrame(camera, viewProjectionMatrix) {
        this.cameraPosition = [...camera.position];
        this.cameraForward = [...camera.forward];
        this.viewProjectionMatrix = viewProjectionMatrix;
        this.resetGrid();
    }

    resetGrid() {
        this.depthGrid.fill(Infinity);
    }

    isFacingCamera(objPos, camPos, camFwd) {
        const toObj = [
            objPos[0] - camPos[0],
            objPos[1] - camPos[1],
            objPos[2] - camPos[2],
        ];
        const dot = toObj[0] * camFwd[0] + toObj[1] * camFwd[1] + toObj[2] * camFwd[2];
        return dot > 0;
    }

    // Project 8 sudut AABB ke screen-space NDC.
    // Lebih akurat dari sphere-radius approximation — penting untuk objek lebar/tinggi.
    projectBounds(bounds) {
        if (!this.viewProjectionMatrix || !bounds) return null;
        const c  = bounds.center;
        const h  = bounds.halfSize || [bounds.radius, bounds.radius, bounds.radius];
        const R  = this.gridResolution;

        let sMinX = Infinity, sMaxX = -Infinity;
        let sMinY = Infinity, sMaxY = -Infinity;
        let depthMin = Infinity;   // NDC Z terdekat (terkecil = lebih dekat ke kamera)
        let depthCenter = 1;

        // Project center untuk depth reference
        const cc = multiplyVec4(this.viewProjectionMatrix, c[0], c[1], c[2], 1);
        if (cc[3] > 0.001) depthCenter = cc[2] / cc[3];

        // Project 8 sudut AABB
        for (let xi = -1; xi <= 1; xi += 2) {
            for (let yi = -1; yi <= 1; yi += 2) {
                for (let zi = -1; zi <= 1; zi += 2) {
                    const clip = multiplyVec4(
                        this.viewProjectionMatrix,
                        c[0] + xi * h[0],
                        c[1] + yi * h[1],
                        c[2] + zi * h[2],
                        1
                    );
                    if (clip[3] <= 0.001) continue;
                    const iw = 1 / clip[3];
                    const nx = clip[0] * iw;
                    const ny = clip[1] * iw;
                    const nz = clip[2] * iw;
                    if (nx < sMinX) sMinX = nx;
                    if (nx > sMaxX) sMaxX = nx;
                    if (ny < sMinY) sMinY = ny;
                    if (ny > sMaxY) sMaxY = ny;
                    if (nz < depthMin) depthMin = nz;
                }
            }
        }

        if (sMinX === Infinity) return null;

        // NDC [-1,1] → grid [0, R-1]; NDC Y is flipped (top = +1)
        const minX = clamp(Math.floor(( sMinX * 0.5 + 0.5) * R), 0, R - 1);
        const maxX = clamp(Math.ceil (( sMaxX * 0.5 + 0.5) * R), 0, R - 1);
        const minY = clamp(Math.floor((-sMaxY * 0.5 + 0.5) * R), 0, R - 1);
        const maxY = clamp(Math.ceil ((-sMinY * 0.5 + 0.5) * R), 0, R - 1);

        if (minX > maxX || minY > maxY) return null;
        return { minX, maxX, minY, maxY, depthFront: depthMin, depthCenter };
    }

    isOccluded(bounds) {
        const proj = this.projectBounds(bounds);
        if (!proj) return false;

        let covered = 0;
        let blocked = 0;
        for (let y = proj.minY; y <= proj.maxY; y++) {
            for (let x = proj.minX; x <= proj.maxX; x++) {
                const cellDepth = this.depthGrid[y * this.gridResolution + x];
                covered++;
                // Pakai depthFront (sisi paling dekat kamera), bukan depthCenter.
                // Bias 0.02 untuk toleransi floating-point.
                if (cellDepth < proj.depthFront - 0.02) blocked++;
            }
        }
        // Turunkan threshold 85% → 70% agar lebih sensitif
        return covered > 0 && (blocked / covered) >= 0.70;
    }

    registerVisibleObject(bounds, weight = 1) {
        const proj = this.projectBounds(bounds);
        if (!proj) return;
        // Tulis depthFront (sisi terdekat occluder) ke depth grid
        const writeDepth = proj.depthFront - 0.004 * weight;
        for (let y = proj.minY; y <= proj.maxY; y++) {
            for (let x = proj.minX; x <= proj.maxX; x++) {
                const idx = y * this.gridResolution + x;
                if (writeDepth < this.depthGrid[idx]) this.depthGrid[idx] = writeDepth;
            }
        }
    }

    shouldRender(object, objDist, camPos, camFwd) {
        if (!this.enabled) return true;
        // Tidak filter dengan isFacingCamera — dari view samping semua objek
        // akan di-skip karena dot product mendekati 0. Cukup cek depth grid.
        return !this.isOccluded(object.bounds);
    }
}
