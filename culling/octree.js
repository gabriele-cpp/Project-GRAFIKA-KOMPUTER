import { Frustum } from './frustum.js';


// OctreeNode — satu kotak 3D dalam pohon
class OctreeNode {
    /**
     * @param {number[]} center  - Pusat AABB [x, y, z]
     * @param {number}   halfSize - Setengah ukuran sisi kotak
     * @param {number}   depth   - Kedalaman node saat ini
     */
    constructor(center, halfSize, depth = 0) {
        this.center   = center;
        this.halfSize = halfSize;
        this.depth    = depth;
        this.objects  = [];    // Array objek yang ada di node ini (hanya leaf)
        this.children = null;  // Null = leaf node; array[8] = internal node
    }

    /** Cek apakah titik berada di dalam AABB node ini */
    containsPoint(x, y, z) {
        const h = this.halfSize;
        const c = this.center;
        return (
            x >= c[0]-h && x <= c[0]+h &&
            y >= c[1]-h && y <= c[1]+h &&
            z >= c[2]-h && z <= c[2]+h
        );
    }

    /** Radius bounding sphere node untuk cek frustum */
    get boundingRadius() {
        // Sphere yang membungkus seluruh AABB (diagonal/2)
        return this.halfSize * Math.SQRT2 * 1.2; // 1.2 = safety margin
    }
}

// Octree — pohon utama
export class Octree {
    /**
     * @param {number}   worldSize  - Ukuran separuh dunia (misal 500 → -500..500)
     * @param {number}   maxDepth   - Kedalaman maksimum rekursi
     * @param {number}   maxObjects - Maks objek per leaf sebelum subdivide
     */
    constructor(worldSize = 500, maxDepth = 5, maxObjects = 20) {
        this.worldSize  = worldSize;
        this.maxDepth   = maxDepth;
        this.maxObjects = maxObjects;

        // Root node mencakup seluruh dunia
        this.root = new OctreeNode([0, 0, 0], worldSize, 0);

        // Statistik untuk UI
        this.stats = {
            totalNodes: 1,
            leafNodes:  1,
            totalObjects: 0
        };
    }


    // INSERT: Masukkan objek ke dalam octree
    insert(obj) {
        this._insertNode(this.root, obj);
        this.stats.totalObjects++;
    }

    _insertNode(node, obj) {
        // Jika node sudah punya anak (internal node), masukkan ke anak yang tepat
        if (node.children !== null) {
            const childIdx = this._getChildIndex(node, obj.pos);
            if (childIdx >= 0) {
                this._insertNode(node.children[childIdx], obj);
                return;
            }
        }

        // Masukkan ke node ini
        node.objects.push(obj);

        // Cek apakah perlu subdivide
        if (
            node.objects.length > this.maxObjects &&
            node.depth < this.maxDepth &&
            node.children === null
        ) {
            this._subdivide(node);
        }
    }

    _getChildIndex(node, pos) {
        const c = node.center;
        const x = pos[0] >= c[0] ? 1 : 0;
        const y = pos[1] >= c[1] ? 1 : 0;
        const z = pos[2] >= c[2] ? 1 : 0;
        return x + y*2 + z*4;
    }

    _subdivide(node) {
        const h  = node.halfSize / 2;
        const c  = node.center;
        const d  = node.depth + 1;

        // Buat 8 anak (oktan)
        node.children = [
            new OctreeNode([c[0]-h, c[1]-h, c[2]-h], h, d), // 000
            new OctreeNode([c[0]+h, c[1]-h, c[2]-h], h, d), // 100
            new OctreeNode([c[0]-h, c[1]+h, c[2]-h], h, d), // 010
            new OctreeNode([c[0]+h, c[1]+h, c[2]-h], h, d), // 110
            new OctreeNode([c[0]-h, c[1]-h, c[2]+h], h, d), // 001
            new OctreeNode([c[0]+h, c[1]-h, c[2]+h], h, d), // 101
            new OctreeNode([c[0]-h, c[1]+h, c[2]+h], h, d), // 011
            new OctreeNode([c[0]+h, c[1]+h, c[2]+h], h, d), // 111
        ];

        this.stats.totalNodes  += 8;
        this.stats.leafNodes   += 7; // 8 baru, 1 lama jadi internal

        // Pindahkan objek dari node ini ke anak yang tepat
        const oldObjects = node.objects;
        node.objects = [];
        for (const obj of oldObjects) {
            const idx = this._getChildIndex(node, obj.pos);
            this._insertNode(node.children[idx], obj);
        }
    }


    // QUERY: Kumpulkan semua objek yang lolos frustum culling
    // Ini adalah inti optimasi: node yang di luar frustum di-skip
    // tanpa traverse ke bawah

    /**
     * Kumpulkan semua objek yang visible (lolos frustum culling via octree)
     * @param {Frustum} frustum
     * @param {Array}   result  - Array yang diisi dengan objek visible
     */
    queryFrustum(frustum, result) {
        result.length = 0;
        this._queryNode(this.root, frustum, result);
    }

    _queryNode(node, frustum, result) {
        const c = node.center;

        // Cek apakah SELURUH node ini ada di dalam frustum
        // Jika node tidak menyentuh frustum → skip semua isinya (KEY OPTIMIZATION)
        if (!frustum.containsSphere(c[0], c[1], c[2], node.boundingRadius)) {
            return; // Entire node di-cull
        }

        // Ambil objek di node ini
        for (const obj of node.objects) {
            result.push(obj);
        }

        // Traverse ke anak
        if (node.children !== null) {
            for (let i = 0; i < 8; i++) {
                this._queryNode(node.children[i], frustum, result);
            }
        }
    }


    // REBUILD: Buat ulang octree (dipakai saat generate objek baru)
    rebuild(objects) {
        this.root  = new OctreeNode([0, 0, 0], this.worldSize, 0);
        this.stats = { totalNodes: 1, leafNodes: 1, totalObjects: 0 };
        for (const obj of objects) {
            this.insert(obj);
        }
    }
}
