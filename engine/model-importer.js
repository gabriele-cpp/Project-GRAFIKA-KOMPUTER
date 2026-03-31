// ============================================================
// engine/model-importer.js  [FIX TOTAL]
//
// Fix utama:
//   1. Load KHRMaterialsSpecularExtension agar texture diffuse
//      dari KHR_materials_pbrSpecularGlossiness terbaca
//   2. Set frustumCulled=false + visible=true pada SEMUA mesh
//      (termasuk SkinnedMesh yang ter-cull karena skeleton)
//   3. Auto-center + auto-scale dari bounding box yang akurat
//   4. Sync kamera Three.js ↔ kamera WebGL setiap frame
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

    // ── init ──────────────────────────────────────────────────
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

    // ── syncCamera: dipanggil setiap frame dari main.js ───────
    syncCamera(mainCam) {
        if (!this._ready || !this.renderer || !this._visible) return;

        const cam = this.camera;
        const [px, py, pz] = mainCam.position;
        cam.position.set(px, py, pz);

        // Rebuild look-at dari yaw + pitch (sama persis dengan WebGL camera)
        const cp = Math.cos(mainCam.pitch), sp = Math.sin(mainCam.pitch);
        const cy = Math.cos(mainCam.yaw),   sy = Math.sin(mainCam.yaw);
        cam.lookAt(px + cp * sy, py + sp, pz + cp * -cy);

        const delta = this.clock.getDelta();
        if (this._mixer) this._mixer.update(delta);
        this.renderer.render(this.scene, cam);
    }

    // ── loadFile ──────────────────────────────────────────────
    async loadFile(file) {
        if (!this._ready) { const ok = await this.init(); if (!ok) return; }
        const ext = file.name.split('.').pop().toLowerCase();
        const url = URL.createObjectURL(file);
        this.onProgress?.(0);
        try {
            let object;
            if      (ext === 'glb' || ext === 'gltf') object = await this._loadGLTF(url);
            else if (ext === 'obj')                    object = await this._loadOBJ(url);
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

    // ── loadFiles: multi-file (GLTF + sidecar .bin) ───────────
    async loadFiles(files) {
        if (!this._ready) { const ok = await this.init(); if (!ok) return; }
        const arr      = Array.from(files);
        const mainFile = arr.find(f => ['glb','gltf','obj'].includes(f.name.split('.').pop().toLowerCase()));
        if (!mainFile) { this.onError?.('Tidak ada file utama (GLB/GLTF/OBJ).'); return; }

        const ext = mainFile.name.split('.').pop().toLowerCase();
        if (ext === 'glb' || ext === 'obj') { await this.loadFile(mainFile); return; }

        // GLTF + sidecar
        const urlMap = {}, objectURLs = [];
        for (const f of arr) { const u = URL.createObjectURL(f); urlMap[f.name] = u; objectURLs.push(u); }
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
    }

    // ── remove ────────────────────────────────────────────────
    remove() {
        this._clearInstanceGroup();
        if (this._template) { this._dispose(this._template); this._template = null; }
        if (this._mixer)    { this._mixer.stopAllAction(); this._mixer = null; }
        this._visible = false;
        if (this._canvas) this._canvas.style.display = 'none';
        this._posX = this._posY = 0; this._posZ = 55;
        this.rotX = this.rotY = 0;
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

    // ─── PRIVATE ──────────────────────────────────────────────

    _setupScene() {
        const THREE = this.THREE;

        this._canvas = document.createElement('canvas');
        this._canvas.id = 'importer-canvas';
        this._canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:10;display:none;';
        document.body.appendChild(this._canvas);

        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 5000);
        this.camera.position.set(0, 0, 80);

        this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping      = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Natural 3-point lighting — warna tampil apa adanya
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const sun  = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(5, 10, 8);   this.scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-5, 2, -5); this.scene.add(fill);
        const rim  = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(0, -5, -10); this.scene.add(rim);

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
        document.addEventListener('mouseup',   () => { this._dragging = false; });
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

    // ── Loaders ───────────────────────────────────────────────

    async _loadGLTF(url) {
        // FIX 1: Load KHRMaterialsSpecularExtension untuk support
        //         KHR_materials_pbrSpecularGlossiness (banyak dipakai model anime/game)
        const { GLTFLoader }                    = await import('three/addons/loaders/GLTFLoader.js');
        const { KHRMaterialsSpecularExtension } = await import('three/addons/loaders/KHRMaterialsSpecularExtension.js').catch(() => ({ KHRMaterialsSpecularExtension: null }));
        const { KHRMaterialsPBRSpecularGlossiness } = await import('three/addons/loaders/KHRMaterialsPBRSpecularGlossiness.js').catch(() => ({ KHRMaterialsPBRSpecularGlossiness: null }));

        const loader = new GLTFLoader();

        // Register extensions jika tersedia
        if (KHRMaterialsPBRSpecularGlossiness) {
            loader.register(parser => new KHRMaterialsPBRSpecularGlossiness(parser));
        }
        if (KHRMaterialsSpecularExtension) {
            loader.register(parser => new KHRMaterialsSpecularExtension(parser));
        }

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                gltf => {
                    const scene = gltf.scene || gltf.scenes?.[0];
                    if (!scene) { reject(new Error('Tidak ada scene di file GLB/GLTF')); return; }
                    scene.animations = gltf.animations || [];
                    resolve(scene);
                },
                xhr => { if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100)); },
                reject
            );
        });
    }

    async _loadGLTFWithSidecar(mainURL, urlMap) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const { KHRMaterialsPBRSpecularGlossiness } = await import('three/addons/loaders/KHRMaterialsPBRSpecularGlossiness.js').catch(() => ({ KHRMaterialsPBRSpecularGlossiness: null }));

        const manager = new this.THREE.LoadingManager();
        manager.setURLModifier(url => {
            const name = url.split('/').pop().split('?')[0];
            return urlMap[name] || url;
        });

        const loader = new GLTFLoader(manager);
        if (KHRMaterialsPBRSpecularGlossiness) {
            loader.register(parser => new KHRMaterialsPBRSpecularGlossiness(parser));
        }

        return new Promise((resolve, reject) => {
            loader.load(mainURL,
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

    // ── _placeModel ───────────────────────────────────────────
    _placeModel(object, file) {
        const THREE = this.THREE;

        this._clearInstanceGroup();
        if (this._template) this._dispose(this._template);
        if (this._mixer)    { this._mixer.stopAllAction(); this._mixer = null; }

        // FIX 2: Set visible=true + frustumCulled=false pada SEMUA mesh
        //         SkinnedMesh sering ter-cull karena bounding box skeleton belum ter-update
        object.traverse(child => {
            child.visible = true;
            if (child.isMesh || child.isSkinnedMesh) {
                child.frustumCulled = false;   // KRITIS untuk SkinnedMesh
                child.castShadow    = false;
                child.receiveShadow = false;
            }
        });

        // FIX 3: Tambah ke scene dulu, update matrix, BARU ukur bounding box
        //         Tanpa ini, SkinnedMesh bounding box tidak akurat
        this.scene.add(object);
        object.updateMatrixWorld(true);

        // Hitung bounding box dari semua mesh yang visible
        const box    = new THREE.Box3();
        object.traverse(child => {
            if ((child.isMesh || child.isSkinnedMesh) && child.geometry) {
                child.geometry.computeBoundingBox();
                const childBox = child.geometry.boundingBox.clone();
                childBox.applyMatrix4(child.matrixWorld);
                box.union(childBox);
            }
        });

        // Fallback jika bounding box kosong
        if (box.isEmpty()) {
            box.setFromObject(object);
        }

        const sizeVec = new THREE.Vector3();
        const center  = new THREE.Vector3();
        box.getSize(sizeVec);
        box.getCenter(center);

        this.scene.remove(object);

        // FIX 4: Center model ke origin via posisi group, bukan manipulasi object itu sendiri
        // Ini mempertahankan hierarki skeleton
        object.position.set(-center.x, -center.y, -center.z);

        const maxDim   = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.001);
        const autoScale = 8.0 / maxDim;

        this.scaleX = this.scaleY = this.scaleZ = autoScale;
        this._posX  = 0; this._posY = 0; this._posZ = 55;
        this.rotX   = 0; this.rotY  = 0;

        const meta = `Size: ${sizeVec.x.toFixed(2)} × ${sizeVec.y.toFixed(2)} × ${sizeVec.z.toFixed(2)}`;
        this._template = object;

        // Animasi jika ada
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
            const clone = this._cloneDeep(this._template);
            const pos   = this.instancePositions[i] || [this._posX, this._posY, this._posZ];
            clone.position.set(pos[0], pos[1], pos[2]);
            clone.rotation.set(this.rotX, this.rotY, 0);
            clone.scale.set(this.scaleX, this.scaleY, this.scaleZ);

            // FIX: Pastikan clone juga punya frustumCulled=false
            clone.traverse(child => {
                child.visible = true;
                if (child.isMesh || child.isSkinnedMesh) {
                    child.frustumCulled = false;
                }
            });

            group.add(clone);
        }

        this._instanceGroup = group;
        this.scene.add(group);
    }

    // Deep clone yang preserve SkinnedMesh skeleton binding
    _cloneDeep(source) {
        const clone = source.clone(true);
        // Re-bind skeleton untuk SkinnedMesh setelah clone
        const sourceBones = [];
        const cloneBones  = [];
        source.traverse(c => { if (c.isBone) sourceBones.push(c); });
        clone.traverse(c  => { if (c.isBone) cloneBones.push(c); });

        clone.traverse(child => {
            if (child.isSkinnedMesh && child.skeleton) {
                // Map bone dari source ke clone
                const newBones = child.skeleton.bones.map(b => {
                    const idx = sourceBones.indexOf(b);
                    return idx >= 0 ? cloneBones[idx] : b;
                });
                child.skeleton = new this.THREE.Skeleton(newBones, child.skeleton.boneInverses);
                child.bind(child.skeleton, child.bindMatrix);
            }
            // Clone material agar independen
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
        const spacing = Math.max(avg * 2.5, 15);
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
                mats.forEach(m => {
                    Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
                    m.dispose();
                });
            }
        });
    }
}
