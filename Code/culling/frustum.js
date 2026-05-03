import { mat4 } from '../engine/math.js';

export class Frustum {
    constructor() {
        this.planes = new Array(6).fill(0).map(() => new Float32Array(4));
    }

    update(projectionMatrix, viewMatrix) {
        const viewProj = mat4.create();
        mat4.multiply(viewProj, projectionMatrix, viewMatrix);
        const m = viewProj;

        this.planes[0].set([m[3]+m[0],  m[7]+m[4],  m[11]+m[8],  m[15]+m[12]]); // Kiri
        this.planes[1].set([m[3]-m[0],  m[7]-m[4],  m[11]-m[8],  m[15]-m[12]]); // Kanan
        this.planes[2].set([m[3]+m[1],  m[7]+m[5],  m[11]+m[9],  m[15]+m[13]]); // Bawah
        this.planes[3].set([m[3]-m[1],  m[7]-m[5],  m[11]-m[9],  m[15]-m[13]]); // Atas
        this.planes[4].set([m[3]+m[2],  m[7]+m[6],  m[11]+m[10], m[15]+m[14]]); // Near
        this.planes[5].set([m[3]-m[2],  m[7]-m[6],  m[11]-m[10], m[15]-m[14]]); // Far

        for (let i = 0; i < 6; i++) {
            const p = this.planes[i];
            const len = Math.hypot(p[0], p[1], p[2]);
            p[0]/=len; p[1]/=len; p[2]/=len; p[3]/=len;
        }
    }

    containsSphere(x, y, z, radius) {
        for (let i = 0; i < 6; i++) {
            const p = this.planes[i];
            if (p[0]*x + p[1]*y + p[2]*z + p[3] <= -radius) return false;
        }
        return true;
    }
}
