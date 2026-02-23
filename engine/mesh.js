export class Mesh {
    constructor(gl) {
        this.gl = gl;

        const vertices = new Float32Array([
            // Depan, Belakang, Atas, Bawah, Kanan, Kiri (Sama seperti sebelumnya)
            -1.0, -1.0,  1.0,   1.0, -1.0,  1.0,   1.0,  1.0,  1.0,  -1.0,  1.0,  1.0,
            -1.0, -1.0, -1.0,  -1.0,  1.0, -1.0,   1.0,  1.0, -1.0,   1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,  -1.0,  1.0,  1.0,   1.0,  1.0,  1.0,   1.0,  1.0, -1.0,
            -1.0, -1.0, -1.0,   1.0, -1.0, -1.0,   1.0, -1.0,  1.0,  -1.0, -1.0,  1.0,
            1.0, -1.0, -1.0,   1.0,  1.0, -1.0,   1.0,  1.0,  1.0,   1.0, -1.0,  1.0,
            -1.0, -1.0, -1.0,  -1.0, -1.0,  1.0,  -1.0,  1.0,  1.0,  -1.0,  1.0, -1.0,
        ]);

        // Arah permukaan setiap sisi kubus (Untuk pantulan cahaya)
        const normals = new Float32Array([
            0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1, // Depan menghadap Z+
            0, 0,-1,   0, 0,-1,   0, 0,-1,   0, 0,-1, // Belakang menghadap Z-
            0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0, // Atas menghadap Y+
            0,-1, 0,   0,-1, 0,   0,-1, 0,   0,-1, 0, // Bawah menghadap Y-
            1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0, // Kanan menghadap X+
            -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0, // Kiri menghadap X-
        ]);

        const indices = new Uint16Array([
            0,  1,  2,      0,  2,  3,    4,  5,  6,      4,  6,  7,
            8,  9,  10,     8,  10, 11,   12, 13, 14,     12, 14, 15,
            16, 17, 18,     16, 18, 19,   20, 21, 22,     20, 22, 23
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Buffer baru untuk cahaya
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

        const positionLocation = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        // Kasih tahu GPU tempat nyari data pantulan cahaya
        const normalLocation = gl.getAttribLocation(shaderProgram, "aVertexNormal");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLocation);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}