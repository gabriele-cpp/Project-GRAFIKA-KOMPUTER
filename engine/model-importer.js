// ============================================================
// engine/model-importer.js  [BARU]
//
// Three.js loader untuk Import Object panel.
// Perbedaan dengan model-loader.js lama:
//   - Objek ditampilkan AS-IS (tanpa auto-scale / centering)
//   - Scale dikendalikan PENUH oleh user (per-axis X/Y/Z)
//   - Instancing 1–100 via WebGL (extractGeometry -> GeometryMesh)
//   - Mouse translate: klik+drag di scene -> geser posisi instances
//   - Mouse rotate: Shift+klik+drag -> putar model
//   - Three.js canvas overlay hanya untuk preview single model
// ============================================================

export class ModelImporter {
    constructor() {
        this.THREE    = null;
        this.scene    = null;
        this.camera   = null;
        this.renderer = null;
        this.model    = null;
        this.mixer    = null;
        this.clock    = null;
        this._canvas  = null;
        this._rafId   = null;
        this._ready   = false;
        this._visible = false;

        // Scale — tidak ada auto-scale, semua dari user
        this.scaleX = 1.0;
        this.scaleY = 1.0;
        this.scaleZ = 1.0;

        // Rotation dari mouse drag
        this.rotX = 0;
        this.rotY = 0;

        // Instance positions (array of [x,y,z])
        // Default: instances disusun dalam grid di depan kamera
        this.instanceCount    = 1;
        this.instancePositions = [[0, 0, 0]];

        // Mouse interaction state
        this._dragging   = false;
        this._shiftDrag  = false;
        this._lastMX     = 0;
        this._lastMY     = 0;
        this._translateX = 0;
        this._translateY = 0;
        this._translateZ = -10; // mulai di depan kamera

        // Callbacks
        this.onLoad     = null; // (filename, ext) => void
        this.onError    = null; // (msg) => void
        this.onProgress = null; // (0-100) => void
        // Called setelah model siap: (geo, instancePositions, scaleX,Y,Z) => void
        this.onGeometryReady = null;
    }

    // ── Public: inisialisasi Three.js (lazy) ──
    async init() {
        if (this._ready) return true;
        try {
            this.THREE = await import('three');
        } catch (e) {
            this.onError?.('Gagal memuat Three.js: ' + e.message);
            return false;
        }
        this._setupScene();
        this._startLoop();
        this._bindMouseOnCanvas();
        this._ready = true;
        return true;
    }

    // ── Public: load file ──
    async loadFile(file) {
        if (!this._ready) {
            const ok = await this.init();
            if (!ok) return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        const url = URL.createObjectURL(file);
        this.onProgress?.(0);
        try {
            let object;
            if (ext === 'glb' || ext === 'gltf') {
                object = await this._loadGLTF(url);
            } else if (ext === 'obj') {
                object = await this._loadOBJ(url);
            } else {
                this.onError?.('Format .' + ext + ' tidak didukung.');
                URL.revokeObjectURL(url);
                return;
            }
            this._placeModel(object, file);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[ModelImporter]', err);
            this.onError?.('Gagal memuat: ' + (err.message || err));
            URL.revokeObjectURL(url);
        }
    }

    // ── Public: remove model ──
    remove() {
        if (this.model) { this.scene?.remove(this.model); this._dispose(this.model); this.model = null; }
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
        this._visible = false;
        if (this._canvas) this._canvas.style.display = 'none';
        this._translateX = 0; this._translateY = 0; this._translateZ = -10;
        this.rotX = 0; this.rotY = 0;
        this.scaleX = this.scaleY = this.scaleZ = 1.0;
        this.instanceCount = 1;
        this.instancePositions = [[0,0,0]];
    }

    // ── Public: set instance count & regenerate positions ──
    setInstanceCount(n) {
        this.instanceCount = Math.max(1, Math.min(100, n));
        this._generateInstancePositions();
        this._notifyGeometry();
    }

    // ── Public: set scale (per-axis) ──
    setScale(x, y, z) {
        this.scaleX = x; this.scaleY = y; this.scaleZ = z;
        if (this.model) {
            this.model.scale.set(x, y, z);
        }
        this._notifyGeometry();
    }

    // ── Public: extract geometry for WebGL instancing ──
    extractGeometry() {
        if (!this.model || !this.THREE) return null;
        const allV = [], allN = [], allI = [];
        let offset = 0;
        this.model.updateMatrixWorld(true);
        this.model.traverse(child => {
            if (!child.isMesh) return;
            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            if (!geo.attributes.normal) geo.computeVertexNormals();
            const pos = geo.attributes.position;
            const nrm = geo.attributes.normal;
            const idx = geo.index;
            if (!pos) return;
            for (let i = 0; i < pos.count; i++) {
                allV.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                allN.push(nrm ? nrm.getX(i) : 0, nrm ? nrm.getY(i) : 1, nrm ? nrm.getZ(i) : 0);
            }
            if (idx) { for (let i = 0; i < idx.count; i++) allI.push(idx.getX(i) + offset); }
            else      { for (let i = 0; i < pos.count; i++) allI.push(i + offset); }
            offset += pos.count;
        });
        if (allV.length === 0) return null;
        return { vertices: allV, normals: allN, indices: allI };
    }

    // ─── Private ──────────────────────────────────────────────

    _setupScene() {
        const THREE = this.THREE;

        this._canvas = document.createElement('canvas');
        this._canvas.id = 'importer-canvas';
        this._canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:6;display:none;';
        document.body.appendChild(this._canvas);

        this.scene  = new THREE.Scene();
        this.clock  = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 5000);
        this.camera.position.set(0, 2, 15);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        // Lighting
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const key = new THREE.DirectionalLight(0x00c8ff, 1.5);
        key.position.set(5, 10, 5);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0x7b2fff, 0.5);
        fill.position.set(-5, -3, -5);
        this.scene.add(fill);
        const rim = new THREE.DirectionalLight(0x00ff88, 0.4);
        rim.position.set(0, -8, 8);
        this.scene.add(rim);

        window.addEventListener('resize', () => {
            if (!this.renderer) return;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _startLoop() {
        const loop = () => {
            this._rafId = requestAnimationFrame(loop);
            if (!this._visible || !this.renderer || !this.model) return;
            const delta = this.clock.getDelta();
            if (this.mixer) this.mixer.update(delta);
            // Apply rotation from mouse drag
            this.model.rotation.x = this.rotX;
            this.model.rotation.y = this.rotY;
            // Apply translate
            this.model.position.set(this._translateX, this._translateY, this._translateZ);
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    _bindMouseOnCanvas() {
        // Mouse events on the WEBGL canvas (not the Three.js overlay)
        // We listen on document but only react when canvas is active
        document.addEventListener('mousedown', e => {
            if (!this._visible || !this.model) return;
            // Skip if clicking on UI panels
            if (e.target.closest('#left-panel') ||
                e.target.closest('#left-panel-toggle') ||
                e.target.closest('#import-panel') ||
                e.target.closest('#ip-toggle') ||
                e.target.closest('#perf-overlay')) return;
            this._dragging  = true;
            this._shiftDrag = e.shiftKey;
            this._lastMX    = e.clientX;
            this._lastMY    = e.clientY;
        });

        document.addEventListener('mouseup', () => { this._dragging = false; });

        document.addEventListener('mousemove', e => {
            if (!this._dragging || !this._visible) return;
            const dx = e.clientX - this._lastMX;
            const dy = e.clientY - this._lastMY;
            this._lastMX = e.clientX;
            this._lastMY = e.clientY;

            if (this._shiftDrag || e.shiftKey) {
                // Rotate
                this.rotY += dx * 0.008;
                this.rotX += dy * 0.008;
            } else {
                // Translate (screen-space)
                const speed = 0.03;
                this._translateX += dx * speed;
                this._translateY -= dy * speed;
            }

            // Sync instances to follow translate
            this._generateInstancePositions();
            this._notifyGeometry();
        });
    }

    async _loadGLTF(url) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        return new Promise((resolve, reject) => {
            new GLTFLoader().load(url, gltf => {
                gltf.scene.traverse(c => { if (c.isMesh) c.castShadow = true; });
                gltf.scene.animations = gltf.animations || [];
                resolve(gltf.scene);
            },
            xhr => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded/xhr.total*100)); },
            reject);
        });
    }

    async _loadOBJ(url) {
        const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        return new Promise((resolve, reject) => {
            new OBJLoader().load(url, obj => {
                const mat = new this.THREE.MeshPhongMaterial({ color: 0x00c8ff, emissive: 0x001122, specular: 0x7b2fff, shininess: 80 });
                obj.traverse(c => { if (c.isMesh) { c.material = mat; c.castShadow = true; } });
                obj.animations = [];
                resolve(obj);
            },
            xhr => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded/xhr.total*100)); },
            reject);
        });
    }

    _placeModel(object, file) {
        if (this.model) { this.scene.remove(this.model); this._dispose(this.model); }
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }

        // AS-IS: tidak ada auto-scale, tidak ada centering paksa
        // Hanya reset position/rotation ke origin agar mudah dikontrol
        object.position.set(this._translateX, this._translateY, this._translateZ);
        object.rotation.set(0, 0, 0);
        object.scale.set(this.scaleX, this.scaleY, this.scaleZ);

        this.model = object;
        this.rotX  = 0;
        this.rotY  = 0;
        this.scene.add(object);

        if (object.animations?.length > 0) {
            this.mixer = new this.THREE.AnimationMixer(object);
            object.animations.forEach(clip => this.mixer.clipAction(clip).play());
        }

        // Hitung bounding box untuk info saja (tidak dipakai untuk scale)
        const box  = new this.THREE.Box3().setFromObject(object);
        const size = new this.THREE.Vector3();
        box.getSize(size);
        const meta = `Size: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`;

        this._generateInstancePositions();
        this._visible = true;
        this._canvas.style.display = 'block';

        this.onLoad?.(file.name, meta);
        this._notifyGeometry();
    }

    _generateInstancePositions() {
        const n = this.instanceCount;
        this.instancePositions = [];
        const cols = Math.ceil(Math.sqrt(n));
        const spacing = 5;
        for (let i = 0; i < n; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            this.instancePositions.push([
                this._translateX + (col - (cols-1)/2) * spacing,
                this._translateY,
                this._translateZ + row * spacing,
            ]);
        }
    }

    _notifyGeometry() {
        if (!this.model) return;
        const geo = this.extractGeometry();
        if (geo) this.onGeometryReady?.(geo, this.instancePositions, this.scaleX, this.scaleY, this.scaleZ);
    }

    _dispose(obj) {
        obj.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });
    }
}
