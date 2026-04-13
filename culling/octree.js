class OctreeNode {
    constructor(center, halfSize, depth = 0) {
        this.center = center;
        this.halfSize = halfSize;
        this.depth = depth;
        this.objects = [];
        this.children = null;
    }

    get boundingRadius() {
        return Math.sqrt(3) * this.halfSize;
    }
}

export class Octree {
    constructor(worldSize = 500, maxDepth = 5, maxObjects = 20) {
        this.worldSize = worldSize;
        this.maxDepth = maxDepth;
        this.maxObjects = maxObjects;
        this.root = new OctreeNode([0, 0, 0], worldSize, 0);
        this.stats = {
            totalNodes: 1,
            leafNodes: 1,
            totalObjects: 0,
            maxDepthReached: 0,
        };
        this.lastQueryStats = {
            visitedNodes: 0,
            rejectedNodes: 0,
            acceptedLeafNodes: 0,
            maxDepthVisited: 0,
        };
    }

    insert(object) {
        this._insertNode(this.root, object);
        this.stats.totalObjects++;
    }

    rebuild(objects) {
        this.root = new OctreeNode([0, 0, 0], this.worldSize, 0);
        this.stats = {
            totalNodes: 1,
            leafNodes: 1,
            totalObjects: 0,
            maxDepthReached: 0,
        };
        for (const object of objects) this.insert(object);
    }

    queryFrustum(frustum, result, outStats = null) {
        result.length = 0;
        const stats = outStats || this.lastQueryStats;
        stats.visitedNodes = 0;
        stats.rejectedNodes = 0;
        stats.acceptedLeafNodes = 0;
        stats.maxDepthVisited = 0;
        this._queryNode(this.root, frustum, result, stats);
        this.lastQueryStats = { ...stats };
        return result;
    }

    _insertNode(node, object) {
        if (node.children !== null) {
            const index = this._getChildIndex(node, object.pos);
            this._insertNode(node.children[index], object);
            return;
        }

        node.objects.push(object);

        if (node.objects.length > this.maxObjects && node.depth < this.maxDepth) {
            this._subdivide(node);
        }
        if (node.depth > this.stats.maxDepthReached) this.stats.maxDepthReached = node.depth;
    }

    _subdivide(node) {
        if (node.children !== null) return;

        const h = node.halfSize / 2;
        const c = node.center;
        const d = node.depth + 1;
        node.children = [
            new OctreeNode([c[0] - h, c[1] - h, c[2] - h], h, d),
            new OctreeNode([c[0] + h, c[1] - h, c[2] - h], h, d),
            new OctreeNode([c[0] - h, c[1] + h, c[2] - h], h, d),
            new OctreeNode([c[0] + h, c[1] + h, c[2] - h], h, d),
            new OctreeNode([c[0] - h, c[1] - h, c[2] + h], h, d),
            new OctreeNode([c[0] + h, c[1] - h, c[2] + h], h, d),
            new OctreeNode([c[0] - h, c[1] + h, c[2] + h], h, d),
            new OctreeNode([c[0] + h, c[1] + h, c[2] + h], h, d),
        ];

        this.stats.totalNodes += 8;
        this.stats.leafNodes += 7;
        this.stats.maxDepthReached = Math.max(this.stats.maxDepthReached, d);

        const oldObjects = node.objects;
        node.objects = [];
        for (const object of oldObjects) {
            const index = this._getChildIndex(node, object.pos);
            this._insertNode(node.children[index], object);
        }
    }

    _getChildIndex(node, position) {
        const c = node.center;
        const x = position[0] >= c[0] ? 1 : 0;
        const y = position[1] >= c[1] ? 1 : 0;
        const z = position[2] >= c[2] ? 1 : 0;
        return x + y * 2 + z * 4;
    }

    _queryNode(node, frustum, result, stats) {
        stats.visitedNodes++;
        stats.maxDepthVisited = Math.max(stats.maxDepthVisited, node.depth);

        if (!frustum.containsSphere(node.center[0], node.center[1], node.center[2], node.boundingRadius)) {
            stats.rejectedNodes++;
            return;
        }

        if (node.children === null) {
            stats.acceptedLeafNodes++;
        }

        for (const object of node.objects) {
            result.push(object);
        }

        if (node.children !== null) {
            for (const child of node.children) this._queryNode(child, frustum, result, stats);
        }
    }
}
