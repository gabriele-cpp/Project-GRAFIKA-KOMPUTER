// Objek sederhana untuk operasi Matriks 4x4
export const mat4 = {
    // Bikin matriks identitas (matriks kosong standar)
    create: function() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },

    // Bikin efek lensa kamera 3D (Perspektif)
    perspective: function(out, fovy, aspect, near, far) {
        let f = 1.0 / Math.tan(fovy / 2);
        let nf = 1 / (near - far);
        out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
        out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
        return out;
    },

    // Memposisikan dan mengarahkan kamera
    lookAt: function(out, eye, center, up) {
        let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
        z0 = eye[0] - center[0]; z1 = eye[1] - center[1]; z2 = eye[2] - center[2];
        len = 1 / Math.hypot(z0, z1, z2);
        z0 *= len; z1 *= len; z2 *= len;
        x0 = up[1] * z2 - up[2] * z1; x1 = up[2] * z0 - up[0] * z2; x2 = up[0] * z1 - up[1] * z0;
        len = 1 / Math.hypot(x0, x1, x2);
        x0 *= len; x1 *= len; x2 *= len;
        y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;

        out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
        out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
        out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
        out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        out[15] = 1;
        return out;
    },

    multiply: function(out, a, b) {
        for (let i = 0; i < 4; i++) {
            let ai0=a[i], ai1=a[i+4], ai2=a[i+8], ai3=a[i+12];
            out[i]    = ai0*b[0]  + ai1*b[1]  + ai2*b[2]  + ai3*b[3];
            out[i+4]  = ai0*b[4]  + ai1*b[5]  + ai2*b[6]  + ai3*b[7];
            out[i+8]  = ai0*b[8]  + ai1*b[9]  + ai2*b[10] + ai3*b[11];
            out[i+12] = ai0*b[12] + ai1*b[13] + ai2*b[14] + ai3*b[15];
        }
        return out;
    }

};