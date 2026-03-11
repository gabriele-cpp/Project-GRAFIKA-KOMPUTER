/**
 * Buat GeometryMesh dari data vertex+normal+index yang diberikan.
 * Interface-nya identik dengan Mesh asli (draw() method).
 */
export class GeometryMesh {
    constructor(gl, vertices, normals, indices) {
        this.gl = gl;

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        const idxArr = indices.length > 65535
            ? new Uint32Array(indices)
            : new Uint16Array(indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxArr, gl.STATIC_DRAW);

        this.indexCount = indices.length;
        this.indexType  = indices.length > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    }

    draw(shaderProgram) {
        const gl = this.gl;
        const posLoc  = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
        const normLoc = gl.getAttribLocation(shaderProgram, 'aVertexNormal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(posLoc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normLoc);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0);
    }
}

// ─────────────────────────────────────────────
// GEOMETRY BUILDERS
// Setiap fungsi mengembalikan { vertices, normals, indices }
// ─────────────────────────────────────────────

/** Cube — identik dengan Mesh.js asli */
function buildCube() {
    const v = [
        -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
        -1,-1,-1, -1, 1,-1,  1, 1,-1,  1,-1,-1,
        -1, 1,-1, -1, 1, 1,  1, 1, 1,  1, 1,-1,
        -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
         1,-1,-1,  1, 1,-1,  1, 1, 1,  1,-1, 1,
        -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
    ];
    const n = [
         0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
         0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
         0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
         0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
         1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ];
    const i = [
         0,1,2, 0,2,3,   4,5,6, 4,6,7,
         8,9,10, 8,10,11, 12,13,14, 12,14,15,
        16,17,18, 16,18,19, 20,21,22, 20,22,23
    ];
    return { vertices: v, normals: n, indices: i };
}

/** Sphere — subdivisi UV dengan stacks × slices */
function buildSphere(stacks = 12, slices = 16) {
    const verts = [], norms = [], idx = [];
    for (let s = 0; s <= stacks; s++) {
        const phi = Math.PI * s / stacks;
        for (let sl = 0; sl <= slices; sl++) {
            const theta = 2 * Math.PI * sl / slices;
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.cos(phi);
            const z = Math.sin(phi) * Math.sin(theta);
            verts.push(x, y, z);
            norms.push(x, y, z); // normal = posisi (unit sphere)
        }
    }
    for (let s = 0; s < stacks; s++) {
        for (let sl = 0; sl < slices; sl++) {
            const a = s * (slices + 1) + sl;
            const b = a + slices + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    return { vertices: verts, normals: norms, indices: idx };
}

/** Cone — apex di atas, base di bawah */
function buildCone(segments = 16, height = 2, radius = 1) {
    const verts = [], norms = [], idx = [];
    const apex = [0, height / 2, 0];

    // Side faces
    for (let i = 0; i <= segments; i++) {
        const a = 2 * Math.PI * i / segments;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        const slope = radius / height;
        const nx = Math.cos(a);
        const ny = slope;
        const nz = Math.sin(a);
        const len = Math.hypot(nx, ny, nz);
        verts.push(x, -height / 2, z);
        norms.push(nx / len, ny / len, nz / len);
    }
    // Apex (shared — one per segment for correct normals)
    for (let i = 0; i < segments; i++) {
        const a0 = 2 * Math.PI * i / segments;
        const a1 = 2 * Math.PI * (i + 1) / segments;
        const mid = (a0 + a1) / 2;
        norms.push(Math.cos(mid), radius / height, Math.sin(mid));
        verts.push(...apex);
        const base = segments + 1 + i;
        idx.push(i, i + 1, base);
    }
    // Bottom cap
    const capCenter = verts.length / 3;
    verts.push(0, -height / 2, 0); norms.push(0, -1, 0);
    for (let i = 0; i < segments; i++) {
        const a = 2 * Math.PI * i / segments;
        verts.push(Math.cos(a) * radius, -height / 2, Math.sin(a) * radius);
        norms.push(0, -1, 0);
    }
    for (let i = 0; i < segments; i++) {
        idx.push(capCenter, capCenter + 1 + (i + 1) % segments, capCenter + 1 + i);
    }
    return { vertices: verts, normals: norms, indices: idx };
}

/** Cylinder */
function buildCylinder(segments = 16, height = 2, radius = 1) {
    const verts = [], norms = [], idx = [];
    // Side rings: top + bottom
    for (let ring = 0; ring <= 1; ring++) {
        const y = ring === 0 ? -height / 2 : height / 2;
        for (let i = 0; i <= segments; i++) {
            const a = 2 * Math.PI * i / segments;
            const x = Math.cos(a) * radius;
            const z = Math.sin(a) * radius;
            verts.push(x, y, z);
            norms.push(Math.cos(a), 0, Math.sin(a));
        }
    }
    for (let i = 0; i < segments; i++) {
        const a = i, b = i + segments + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // Caps
    for (const [capY, capNY] of [[-height / 2, -1], [height / 2, 1]]) {
        const cIdx = verts.length / 3;
        verts.push(0, capY, 0); norms.push(0, capNY, 0);
        for (let i = 0; i < segments; i++) {
            const a = 2 * Math.PI * i / segments;
            verts.push(Math.cos(a) * radius, capY, Math.sin(a) * radius);
            norms.push(0, capNY, 0);
        }
        for (let i = 0; i < segments; i++) {
            const next = (i + 1) % segments;
            if (capNY < 0) idx.push(cIdx, cIdx + 1 + next, cIdx + 1 + i);
            else           idx.push(cIdx, cIdx + 1 + i, cIdx + 1 + next);
        }
    }
    return { vertices: verts, normals: norms, indices: idx };
}

/** Plane — flat quad di bidang XZ */
function buildPlane(size = 1) {
    const s = size;
    const v = [-s, 0,-s,  s, 0,-s,  s, 0, s, -s, 0, s];
    const n = [ 0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0];
    const i = [0, 1, 2, 0, 2, 3];
    return { vertices: v, normals: n, indices: i };
}

/** Pyramid — 4-sided (ConeGeometry segments=4 equivalent) */
function buildPyramid(height = 2, base = 1.4) {
    const h = height / 2;
    const b = base;
    // 4 base corners + 1 apex
    const corners = [
        [-b, -h, -b],
        [ b, -h, -b],
        [ b, -h,  b],
        [-b, -h,  b],
    ];
    const apex = [0, h, 0];

    const verts = [], norms = [], idx = [];

    // 4 side triangles
    for (let i = 0; i < 4; i++) {
        const c0 = corners[i];
        const c1 = corners[(i + 1) % 4];
        // Compute face normal
        const ux = c1[0]-c0[0], uy = c1[1]-c0[1], uz = c1[2]-c0[2];
        const vx = apex[0]-c0[0], vy = apex[1]-c0[1], vz = apex[2]-c0[2];
        const nx = uy*vz - uz*vy;
        const ny = uz*vx - ux*vz;
        const nz = ux*vy - uy*vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        const base_i = verts.length / 3;
        verts.push(...c0, ...c1, ...apex);
        for (let k = 0; k < 3; k++) norms.push(nx/len, ny/len, nz/len);
        idx.push(base_i, base_i+1, base_i+2);
    }
    // Base quad
    const bi = verts.length / 3;
    for (const c of corners) { verts.push(...c); norms.push(0,-1,0); }
    idx.push(bi, bi+2, bi+1, bi, bi+3, bi+2);

    return { vertices: verts, normals: norms, indices: idx };
}

/** Rectangular Prism (Balok) — different width/height/depth */
function buildPrism(w = 2, h = 1, d = 1) {
    const hw = w/2, hh = h/2, hd = d/2;
    // Reuse cube builder, kemudian scale vertex secara non-uniform
    const { vertices, normals, indices } = buildCube();
    const scaled = [];
    for (let i = 0; i < vertices.length; i += 3) {
        scaled.push(vertices[i]*hw, vertices[i+1]*hh, vertices[i+2]*hd);
    }
    return { vertices: scaled, normals, indices };
}

// FACTORY — buat GeometryMesh dari nama bentuk
const GEOMETRY_BUILDERS = {
    cube:      buildCube,
    sphere:    buildSphere,
    cone:      buildCone,
    cylinder:  buildCylinder,
    plane:     buildPlane,
    pyramid:   buildPyramid,
    prism:     buildPrism,
};

/**
 * Buat GeometryMesh berdasarkan nama tipe.
 * @param {WebGL2RenderingContext} gl
 * @param {string} type - 'cube'|'sphere'|'cone'|'cylinder'|'plane'|'pyramid'|'prism'
 * @returns {GeometryMesh}
 */
export function createGeometry(gl, type = 'cube') {
    const builder = GEOMETRY_BUILDERS[type] || GEOMETRY_BUILDERS.cube;
    const { vertices, normals, indices } = builder();
    return new GeometryMesh(gl, vertices, normals, indices);
}

export const GEOMETRY_TYPES = Object.keys(GEOMETRY_BUILDERS);
