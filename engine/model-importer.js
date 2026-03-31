// ============================================================
// engine/model-importer.js  [REWRITE TOTAL]
//
// Strategi:
//   - Canvas Three.js TERPISAH, overlay di atas gameCanvas
//   - alpha:true → background transparan → gameCanvas tetap terlihat
//   - Kamera Three.js di-sync penuh dengan kamera WebGL setiap frame
//   - Auto-center + auto-scale model dengan updateMatrixWorld yang benar
// ============================================================

export class ModelImporter {
    constructor() {
        this.THREE    = null;
        this.scene    = null;
        this.camera   = null;
        this.renderer = null;
        this.clock    = null;
        this._canvas  = null;
        this._ready   = false;
        this._visible = false;

        this._template      = null;
        this._mixer         = null;
        this._instanceGroup = null;

        this.scaleX = 1.0;
        this.scaleY = 1.0;
        this.scaleZ = 1.0;
        this.rotX   = 0;
        this.rotY   = 0;
        this._posX  = 0;
        this._posY  = 0;
        this._posZ  = 55;

        this.instanceCount     = 1;
        this.instancePositions = [[0, 0, 55]];

        this._dragging  = false;
        this._shiftDrag = false;
        this._lastMX    = 0;
        this._lastMY    = 0;

        this.onLoad          = null;
        this.onError         = null;
        this.onProgress      = null;
        this.onGeometryReady = null;
    }

    async init() {
        if (this._ready) return true;
        try {
            this.THREE = await import('three');
        } catch (e) {
            this.onError?.('Gagal memuat Three.js: ' + e.message);
            return false;
        }
        this._setupScene();
        this._bindMouse();
        this._ready = true;
        return true;
    }

    // Dipanggil SETIAP FRAME dari main.js — sync kamera lalu render
    syncCamera(mainCam) {
        if (!this._ready || !this.renderer || !this._visible) return;

        const cam = this.camera;
        cam.position.set(mainCam.position[0], mainCam.position[1], mainCam.position[2]);

        const cp = Math.cos(mainCam.pitch), sp = Math.sin(mainCam.pitch);
        const cy = Math.cos(mainCam.yaw),   sy = Math.sin(mainCam.yaw);
        const dx = cp * sy, dy = sp, dz = cp * -cy;

        cam.lookAt(
            mainCam.position[0] + dx,
            mainCam.position[1] + dy,
            mainCam.position[2] + dz
        );

        const delta = this.clock.getDelta();
        if (this._mixer) this._mixer.update(delta);
        this.renderer.render(this.scene, cam);
    }

    async loadFile(file) {
        if (!this._ready) { const ok = await this.init(); if (!ok) return; }
        const ext = file.name.split('.').pop().toLowerCase();
        const url = URL.createObjectURL(file);
        this.onProgress?.(0);
        try {
            let object;
            if (ext === 'glb' || ext === 'gltf') object = await this._loadGLTF(url);
            else if (ext === 'obj')               object = await this._loadOBJ(url);
            else if (ext === 'bin') {
                this.onError?.('.bin adalah sidecar. Upload .glb/.gltf beserta .bin sekaligus.');
                URL.revokeObjectURL(url); return;
            } else {
                this.onError?.('Format .' + ext + ' tidak didukung.');
                URL.revokeObjectURL(url); return;
            }
            this._placeModel(object, file);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[ModelImporter]', err);
            this.onError?.('Gagal memuat: ' + (err.message || err));
            URL.revokeObjectURL(url);
        }
    }

    async loadFiles(files) {
        if (!this._ready) { const ok = await this.init(); if (!ok) return; }
        const fileArr  = Array.from(files);
        const mainFile = fileArr.find(f => ['glb','gltf','obj'].includes(f.name.split('.').pop().toLowerCase()));
        if (!mainFile) { this.onError?.('Tidak ada file utama (GLB/GLTF/OBJ).'); return; }

        const ext = mainFile.name.split('.').pop().toLowerCase();
        if (ext === 'glb') { await this.loadFile(mainFile); return; }

        if (ext === 'gltf') {
            const urlMap = {}, objectURLs = [];
            for (const f of fileArr) { const u = URL.createObjectURL(f); urlMap[f.name] = u; objectURLs.push(u); }
            const mainURL = urlMap[mainFile.name];
            this.onProgress?.(0);
            try {
                const object = await this._loadGLTFWithSidecar(mainURL, urlMap);
                this._placeModel(object, mainFile);
            } catch (err) {
                this.onError?.('Gagal memuat GLTF: ' + (err.message || err));
            } finally {
                objectURLs.forEach(u => URL.revokeObjectURL(u));
            }
            return;
        }
        await this.loadFile(mainFile);
    }

    remove() {
        this._clearInstanceGroup();
        if (this._template) { this._dispose(this._template); this._template = null; }
        if (this._mixer)    { this._mixer.stopAllAction(); this._mixer = null; }
        this._visible = false;
        if (this._canvas) this._canvas.style.display = 'none';
        this._posX = 0; this._posY = 0; this._posZ = 55;
        this.rotX = 0; this.rotY = 0;
        this.scaleX = this.scaleY = this.scaleZ = 1.0;
        this.instanceCount = 1;
        this.instancePositions = [[0, 0, 55]];
    }

    setInstanceCount(n) {
        this.instanceCount = Math.max(1, Math.min(1000, n));
        this._generateInstancePositions();
        this._rebuildInstances();
    }

    setScale(x, y, z) {
        this.scaleX = x; this.scaleY = y; this.scaleZ = z;
        this._generateInstancePositions();
        this._rebuildInstances();
    }

    extractGeometry() { return null; }

    // ─── PRIVATE ─────────────────────────────────────────────

    _setupScene() {
        const THREE = this.THREE;

        // Canvas overlay — transparan, di atas gameCanvas
        this._canvas = document.createElement('canvas');
        this._canvas.id    = 'importer-canvas';
        this._canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:10;display:none;';
        document.body.appendChild(this._canvas);

        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        // FOV 45° = PI/4 (sama dengan kamera WebGL utama)
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 5000);
        this.camera.position.set(0, 0, 80);

        // alpha:true → Three.js render di atas gameCanvas dengan background transparan
        this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping      = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // 3-point lighting agar warna & texture model tampil sempurna
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
        const sun  = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(10, 20, 10);  this.scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-10, 5, -10); this.scene.add(fill);
        const rim  = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, -10, -20);  this.scene.add(rim);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _bindMouse() {
        document.addEventListener('mousedown', e => {
            if (!this._visible || !this._template) return;
            if (e.target.closest('#left-panel,#left-panel-toggle,#import-panel,#ip-toggle,#perf-overlay')) return;
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
            this._lastMX = e.clientX; this._lastMY = e.clientY;
            if (this._shiftDrag || e.shiftKey) {
                this.rotY += dx * 0.01; this.rotX += dy * 0.01;
            } else {
                this._posX += dx * 0.05; this._posY -= dy * 0.05;
            }
            this._generateInstancePositions();
            this._rebuildInstances();
        });
    }

    async _loadGLTF(url) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        return new Promise((resolve, reject) => {
            new GLTFLoader().load(url,
                gltf => { gltf.scene.animations = gltf.animations || []; resolve(gltf.scene); },
                xhr  => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100)); },
                reject
            );
        });
    }

    async _loadGLTFWithSidecar(mainURL, urlMap) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const manager = new this.THREE.LoadingManager();
        manager.setURLModifier(url => { const name = url.split('/').pop().split('?')[0]; return urlMap[name] || url; });
        return new Promise((resolve, reject) => {
            new GLTFLoader(manager).load(mainURL,
                gltf => { gltf.scene.animations = gltf.animations || []; resolve(gltf.scene); },
                xhr  => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100)); },
                reject
            );
        });
    }

    async _loadOBJ(url) {
        const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        return new Promise((resolve, reject) => {
            new OBJLoader().load(url,
                obj => { obj.animations = []; resolve(obj); },
                xhr => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100)); },
                reject
            );
        });
    }

    _placeModel(object, file) {
        const THREE = this.THREE;

        this._clearInstanceGroup();
        if (this._template) this._dispose(this._template);
        if (this._mixer)    { this._mixer.stopAllAction(); this._mixer = null; }

        // Tambah ke scene sementara agar updateMatrixWorld bisa berjalan
        this.scene.add(object);
        object.updateMatrixWorld(true);

        // Hitung bounding box AKURAT
        const box     = new THREE.Box3().setFromObject(object);
        const sizeVec = new THREE.Vector3();
        const center  = new THREE.Vector3();
        box.getSize(sizeVec);
        box.getCenter(center);

        this.scene.remove(object);

        // Geser ke origin
        object.position.set(-center.x, -center.y, -center.z);

        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.001);
        const meta   = `Size: ${sizeVec.x.toFixed(2)} × ${sizeVec.y.toFixed(2)} × ${sizeVec.z.toFixed(2)}`;

        // Auto-scale → target size 8 unit agar cukup besar terlihat
        const autoScale = 8.0 / maxDim;
        this.scaleX = this.scaleY = this.scaleZ = autoScale;

        // Posisi di depan kamera default
        this._posX = 0; this._posY = 0; this._posZ = 55;
        this.rotX  = 0; this.rotY  = 0;

        this._template = object;

        if (object.animations?.length > 0) {
            this._mixer = new THREE.AnimationMixer(object);
            object.animations.forEach(clip => this._mixer.clipAction(clip).play());
        }

        this._generateInstancePositions();
        this._rebuildInstances();

        this._visible = true;
        this._canvas.style.display = 'block';
        this.onLoad?.(file.name, meta, autoScale);
        this.onGeometryReady?.(null, [], 1, 1, 1);
    }

    _clearInstanceGroup() {
        if (this._instanceGroup) { this.scene.remove(this._instanceGroup); this._instanceGroup = null; }
    }

    _rebuildInstances() {
        if (!this._template) return;
        this._clearInstanceGroup();
        const group = new this.THREE.Group();
        for (let i = 0; i < this.instanceCount; i++) {
            const clone = this._cloneWithMaterials(this._template);
            const pos   = this.instancePositions[i] || [this._posX, this._posY, this._posZ];
            clone.position.set(pos[0], pos[1], pos[2]);
            clone.rotation.set(this.rotX, this.rotY, 0);
            clone.scale.set(this.scaleX, this.scaleY, this.scaleZ);
            group.add(clone);
        }
        this._instanceGroup = group;
        this.scene.add(group);
    }

    _cloneWithMaterials(source) {
        const clone = source.clone(true);
        clone.traverse(child => {
            if (child.isMesh && child.material) {
                child.material = Array.isArray(child.material)
                    ? child.material.map(m => m.clone())
                    : child.material.clone();
            }
        });
        return clone;
    }

    _generateInstancePositions() {
        const n       = this.instanceCount;
        const cols    = Math.ceil(Math.sqrt(n));
        const avg     = (this.scaleX + this.scaleY + this.scaleZ) / 3;
        const spacing = Math.max(avg * 2, 12);
        this.instancePositions = [];
        for (let i = 0; i < n; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            this.instancePositions.push([
                this._posX + (col - (cols - 1) / 2) * spacing,
                this._posY,
                this._posZ - row * spacing,
            ]);
        }
    }

    _dispose(obj) {
        obj.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); }); m.dispose(); });
            }
        });
    }
}
