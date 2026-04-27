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
        this.gridResolution = 24;
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

    projectBounds(bounds) {
        if (!this.viewProjectionMatrix || !bounds) return null;
        const clip = multiplyVec4(
            this.viewProjectionMatrix,
            bounds.center[0],
            bounds.center[1],
            bounds.center[2],
            1
        );
        if (clip[3] <= 0.0001) return null;

        const invW = 1 / clip[3];
        const ndcX = clip[0] * invW;
        const ndcY = clip[1] * invW;
        const ndcZ = clip[2] * invW;

        const projectedRadius = clamp((bounds.radius / Math.max(clip[3], 0.1)) * 2.2, 0.01, 0.7);
        const minX = clamp(Math.floor(((ndcX - projectedRadius) * 0.5 + 0.5) * this.gridResolution), 0, this.gridResolution - 1);
        const maxX = clamp(Math.ceil(((ndcX + projectedRadius) * 0.5 + 0.5) * this.gridResolution), 0, this.gridResolution - 1);
        const minY = clamp(Math.floor(((-ndcY - projectedRadius) * 0.5 + 0.5) * this.gridResolution), 0, this.gridResolution - 1);
        const maxY = clamp(Math.ceil(((-ndcY + projectedRadius) * 0.5 + 0.5) * this.gridResolution), 0, this.gridResolution - 1);

        return {
            minX,
            maxX,
            minY,
            maxY,
            depth: ndcZ,
        };
    }

    isOccluded(bounds) {
        const projection = this.projectBounds(bounds);
        if (!projection) return false;

        let covered = 0;
        let occluded = 0;
        for (let y = projection.minY; y <= projection.maxY; y++) {
            for (let x = projection.minX; x <= projection.maxX; x++) {
                const cellDepth = this.depthGrid[y * this.gridResolution + x];
                covered++;
                if (cellDepth < projection.depth - 0.03) occluded++;
            }
        }
        return covered > 0 && occluded === covered;
    }

    registerVisibleObject(bounds, weight = 1) {
        const projection = this.projectBounds(bounds);
        if (!projection) return;
        const depth = projection.depth - Math.min(0.02, Math.max(0.002, bounds.radius * 0.001 * weight));
        for (let y = projection.minY; y <= projection.maxY; y++) {
            for (let x = projection.minX; x <= projection.maxX; x++) {
                const index = y * this.gridResolution + x;
                if (depth < this.depthGrid[index]) this.depthGrid[index] = depth;
            }
        }
    }

    shouldRender(object, objDist, camPos, camFwd) {
        if (!this.enabled) return true;
        if (!this.isFacingCamera(object.pos, camPos, camFwd)) return false;
        return !this.isOccluded(object.bounds);
    }
}
