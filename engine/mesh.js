// ============================================================
// engine/mesh.js  (dipertahankan dari kode asli — tidak ada perubahan)
// Berisi data vertex, normal, dan index untuk sebuah kubus satuan
// ============================================================
export class Mesh {
    constructor(gl) {
        this.gl = gl;

        const vertices = new Float32Array([
            -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
            -1,-1,-1, -1, 1,-1,  1, 1,-1,  1,-1,-1,
            -1, 1,-1, -1, 1, 1,  1, 1, 1,  1, 1,-1,
            -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
             1,-1,-1,  1, 1,-1,  1, 1, 1,  1,-1, 1,
            -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
        ]);

        const normals = new Float32Array([
             0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
             0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
             0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
             0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
             1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        ]);

        const indices = new Uint16Array([
             0, 1, 2,  0, 2, 3,   4, 5, 6,  4, 6, 7,
             8, 9,10,  8,10,11,  12,13,14, 12,14,15,
            16,17,18, 16,18,19,  20,21,22, 20,22,23
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.indexCount = indices.length;
    }

    draw(shaderProgram) {
        const gl = this.gl;
        const posLoc = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(posLoc);

        const normLoc = gl.getAttribLocation(shaderProgram, 'aVertexNormal');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normLoc);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}
