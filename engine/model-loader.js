export class ModelLoader {
    constructor() {
        this.THREE     = null;
        this.scene     = null;
        this.camera    = null;
        this.renderer  = null;
        this.model     = null;
        this.mixer     = null;
        this.clock     = null;
        this._canvas   = null;
        this._rafId    = null;
        this._ready    = false;
        this._visible  = false;
        this._autoRotate = true;
        this._scale    = 1.0;
        this._rotX     = 0;
        this._rotY     = 0;

        this.onLoad     = null;
        this.onError    = null;
        this.onProgress = null;
    }

    async init() {
        if (this._ready) return true;
        try {
            // Bare specifier 'three' resolved via importmap di index.html
            this.THREE = await import('three');
        } catch (e) {
            this.onError?.('Gagal memuat Three.js. Pastikan koneksi internet aktif. (' + e.message + ')');
            return false;
        }
        this._setupScene();
        this._startLoop();
        this._ready = true;
        return true;
    }

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
                this.onError?.('Format .' + ext + ' tidak didukung. Gunakan GLTF, GLB, atau OBJ.');
                URL.revokeObjectURL(url);
                return;
            }
            this._replaceModel(object, file);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[ModelLoader]', err);
            this.onError?.('Gagal memuat model "' + file.name + '": ' + (err.message || err));
            URL.revokeObjectURL(url);
        }
    }

    removeModel() {
        if (this.model) {
            this.scene.remove(this.model);
            this._disposeObject(this.model);
            this.model = null;
        }
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
        this._visible = false;
        if (this._canvas) this._canvas.style.display = 'none';
    }

    setScale(v) {
        this._scale = v;
        this._autoRotate = false;
        if (this.model) this.model.scale.setScalar(v);
    }

    setRotX(deg) {
        this._rotX = deg;
        this._autoRotate = false;
        if (this.model) this.model.rotation.x = deg * Math.PI / 180;
    }

    setRotY(deg) {
        this._rotY = deg;
        this._autoRotate = false;
        if (this.model) this.model.rotation.y = deg * Math.PI / 180;
    }

    _setupScene() {
        const THREE = this.THREE;

        this._canvas = document.createElement('canvas');
        this._canvas.id = 'three-canvas';
        this._canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:5;display:none;';
        document.body.appendChild(this._canvas);

        this.scene  = new THREE.Scene();
        this.clock  = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 2000);
        this.camera.position.set(0, 1, 5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        // Cyberpunk lighting
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const key = new THREE.DirectionalLight(0x00c8ff, 1.8);
        key.position.set(4, 8, 4);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0x7b2fff, 0.7);
        fill.position.set(-4, -2, -4);
        this.scene.add(fill);
        const rim = new THREE.DirectionalLight(0x00ff88, 0.5);
        rim.position.set(0, -5, 5);
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
            if (!this._visible || !this.renderer) return;
            const delta = this.clock.getDelta();
            if (this.model && this._autoRotate) {
                this.model.rotation.y += delta * 0.5;
            }
            if (this.mixer) this.mixer.update(delta);
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    async _loadGLTF(url) {
        // Gunakan path 'three/addons/' yang di-resolve importmap
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        return new Promise((resolve, reject) => {
            new GLTFLoader().load(
                url,
                gltf => {
                    gltf.scene.traverse(c => {
                        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
                    });
                    gltf.scene.animations = gltf.animations || [];
                    resolve(gltf.scene);
                },
                xhr => {
                    if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100));
                },
                err => reject(err)
            );
        });
    }

    async _loadOBJ(url) {
        const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        return new Promise((resolve, reject) => {
            new OBJLoader().load(
                url,
                obj => {
                    const mat = new this.THREE.MeshPhongMaterial({
                        color: 0x00c8ff, emissive: 0x001122,
                        specular: 0x7b2fff, shininess: 80
                    });
                    obj.traverse(c => {
                        if (c.isMesh) { c.material = mat; c.castShadow = true; c.receiveShadow = true; }
                    });
                    obj.animations = [];
                    resolve(obj);
                },
                xhr => {
                    if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100));
                },
                err => reject(err)
            );
        });
    }

    _replaceModel(object, file) {
        if (this.model) { this.scene.remove(this.model); this._disposeObject(this.model); }
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }

        const THREE  = this.THREE;
        const box    = new THREE.Box3().setFromObject(object);
        const size   = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Center pada origin
        object.position.sub(center);

        // Auto-scale agar max dimension = 2 unit
        const maxDim    = Math.max(size.x, size.y, size.z);
        const baseScale = maxDim > 0 ? 2.0 / maxDim : 1.0;
        object.scale.setScalar(baseScale);

        // Sesuaikan kamera
        const camDist = Math.max(3.5, maxDim * 2.2);
        this.camera.position.set(0, size.y * 0.15, camDist);
        this.camera.lookAt(0, 0, 0);

        this.model        = object;
        this._scale       = 1.0;
        this._rotX        = 0;
        this._rotY        = 0;
        this._autoRotate  = true;

        this.scene.add(object);

        // Play animasi GLTF jika ada
        if (object.animations && object.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(object);
            object.animations.forEach(clip => this.mixer.clipAction(clip).play());
        }

        this._visible = true;
        this._canvas.style.display = 'block';
        this.onLoad?.(file.name);
    }

    _disposeObject(obj) {
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    }

    // PUBLIC: Extract merged geometry dari model yang sudah diload
    // Returns { vertices, normals, indices } untuk WebGL pipeline
    // Dipakai main.js untuk buat GeometryMesh dari model upload
    extractGeometry() {
        if (!this.model || !this.THREE) return null;

        const THREE    = this.THREE;
        const allVerts = [];
        const allNorms = [];
        const allIdx   = [];
        let   offset   = 0;

        // Update matrix world dulu
        this.model.updateMatrixWorld(true);

        this.model.traverse(child => {
            if (!child.isMesh) return;
            let geo = child.geometry.clone();
            // Apply world transform agar posisi relative ke model root
            geo.applyMatrix4(child.matrixWorld);

            // Compute normals jika belum ada
            if (!geo.attributes.normal) geo.computeVertexNormals();

            // Convert ke non-indexed dulu agar mudah
            const pos  = geo.attributes.position;
            const norm = geo.attributes.normal;
            const idx  = geo.index;

            if (!pos) return;

            for (let i = 0; i < pos.count; i++) {
                allVerts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                if (norm) allNorms.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                else      allNorms.push(0, 1, 0);
            }

            if (idx) {
                for (let i = 0; i < idx.count; i++) allIdx.push(idx.getX(i) + offset);
            } else {
                for (let i = 0; i < pos.count; i++) allIdx.push(i + offset);
            }
            offset += pos.count;
        });

        if (allVerts.length === 0) return null;
        return { vertices: allVerts, normals: allNorms, indices: allIdx };
    }
}