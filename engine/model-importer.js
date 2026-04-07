export class ModelImporter {
    constructor() {
        this.THREE = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.raycaster = null;
        this.pointer = null;
        this._canvas = null;
        this._ready = false;
        this._visible = false;

        this.objects = [];
        this.selectedId = null;
        this._idSeq = 1;
        this._mixers = new Map();
        this._pendingFocus = null;

        this._dragging = false;
        this._dragMode = 'translate';
        this._dragPlane = null;
        this._dragStartPoint = null;
        this._dragStartPosition = null;
        this._lastMX = 0;
        this._lastMY = 0;

        this.onLoad = null;
        this.onError = null;
        this.onProgress = null;
        this.onGeometryReady = null;
    }

    async init() {
        if (this._ready) return true;

        try {
            this.THREE = await import('three');
        } catch (error) {
            this.onError?.('Gagal memuat Three.js: ' + error.message);
            return false;
        }

        this._setupScene();
        this._bindMouse();
        this._ready = true;
        return true;
    }

    syncCamera(mainCam) {
        if (!this._ready || !this.renderer || !this._visible) return;

        if (this._pendingFocus) {
            this._focusMainCamera(mainCam, this._pendingFocus);
            this._pendingFocus = null;
        }

        const [px, py, pz] = mainCam.position;
        this.camera.position.set(px, py, pz);

        const cp = Math.cos(mainCam.pitch);
        const sp = Math.sin(mainCam.pitch);
        const cy = Math.cos(mainCam.yaw);
        const sy = Math.sin(mainCam.yaw);
        this.camera.lookAt(px + cp * sy, py + sp, pz + cp * -cy);

        const delta = this.clock.getDelta();
        this._mixers.forEach(mixer => mixer.update(delta));
        this.renderer.render(this.scene, this.camera);
    }

    shouldHandlePointer(event) {
        if (!this._ready || !this._visible || this._isUIPointer(event)) return false;
        return !!this.selectedId || !!this._pickEntry(event);
    }

    async loadFile(file) {
        await this.loadFiles([file]);
    }

    async loadFiles(files) {
        if (!this._ready) {
            const ok = await this.init();
            if (!ok) return;
        }

        const fileArray = Array.from(files || []);
        const mainFiles = fileArray.filter(file => this._isMainModel(file));

        if (mainFiles.length === 0) {
            this.onError?.('Tidak ada file utama. Gunakan GLTF, GLB, atau OBJ.');
            console.error('[ModelImporter] Import gagal: file utama tidak ditemukan.', fileArray);
            return;
        }

        const urlMap = new Map();
        const objectUrls = [];
        for (const file of fileArray) {
            const url = URL.createObjectURL(file);
            objectUrls.push(url);
            urlMap.set(file.name, url);
            urlMap.set(file.name.toLowerCase(), url);
        }

        console.group('[ModelImporter] Import start');
        console.info('Files:', fileArray.map(file => file.name));
        this.onProgress?.(0);

        let loaded = 0;
        try {
            for (const file of mainFiles) {
                const asset = await this._loadObject(file, urlMap);
                const entry = this._addObject(asset, file, loaded, mainFiles.length);
                loaded += 1;
                this.onProgress?.(Math.round((loaded / mainFiles.length) * 100));
                // UI scale controls the wrapper/root transform; the asset has already been normalized internally.
                this.onLoad?.(file.name, entry.meta, 1);
                this.onGeometryReady?.(null, [], 1, 1, 1);
            }
            console.info(`Import selesai: ${loaded}/${mainFiles.length} object berhasil dimuat.`);
        } catch (error) {
            console.error('[ModelImporter] Import gagal:', error);
            this.onError?.('Gagal memuat model: ' + (error.message || error));
        } finally {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
            console.groupEnd();
        }
    }

    async duplicate(id = this.selectedId) {
        const source = this.objects.find(item => item.id === id);
        if (!source) return null;

        const clone = await this._cloneObject(source.asset);
        const entry = this._createEntry(clone, {
            name: this._uniqueName(source.name + ' Copy'),
            type: source.type,
            meta: source.meta,
            autoScale: source.autoScale,
            size: source.size.clone(),
            sourceId: source.sourceId,
        });

        entry.root.position.copy(source.root.position).add(new this.THREE.Vector3(Math.max(source.size.x, 1.5), 0, 0));
        entry.root.rotation.copy(source.root.rotation);
        entry.root.scale.copy(source.root.scale);
        this.scene.add(entry.root);
        this.objects.push(entry);
        this._playAnimations(entry);
        this.select(entry.id);
        this._visible = true;
        this._canvas.style.display = 'block';
        console.info('[ModelImporter] Duplicate created:', this._debugEntry(entry));
        return entry.id;
    }

    remove(id = this.selectedId) {
        if (id) {
            const entry = this.objects.find(item => item.id === id);
            if (entry) this._removeEntry(entry);
        } else {
            for (const entry of [...this.objects]) this._removeEntry(entry);
        }

        if (this.objects.length === 0) {
            this.selectedId = null;
            this._visible = false;
            if (this._canvas) this._canvas.style.display = 'none';
        }
    }

    async setInstanceCount(n) {
        const target = Math.max(1, Math.min(1000, Number.parseInt(n, 10) || 1));
        const selected = this.objects.find(item => item.id === this.selectedId);
        if (!selected) return;

        const related = () => this.objects.filter(item => item.sourceId === selected.sourceId);
        while (related().length < target) await this.duplicate(selected.id);
        while (related().length > target) this._removeEntry(related().at(-1));
    }

    setScale(x, y, z) {
        const selected = this.objects.find(item => item.id === this.selectedId);
        if (!selected) return;

        selected.root.scale.set(
            this._validScale(x),
            this._validScale(y),
            this._validScale(z)
        );
        selected.root.updateMatrixWorld(true);
        console.info('[ModelImporter] Scale updated:', this._debugEntry(selected));
    }

    select(id) {
        this.selectedId = this.objects.some(item => item.id === id) ? id : null;
    }

    extractGeometry() {
        return null;
    }

    _setupScene() {
        const THREE = this.THREE;

        this._canvas = document.createElement('canvas');
        this._canvas.id = 'importer-canvas';
        this._canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:10;display:none;';
        document.body.appendChild(this._canvas);

        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 5000);
        this.camera.position.set(0, 0, 80);

        this.renderer = new THREE.WebGLRenderer({ canvas: this._canvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(6, 10, 8);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.9);
        fill.position.set(-8, 3, -6);
        this.scene.add(fill);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _bindMouse() {
        document.addEventListener('mousedown', event => {
            if (!this._ready || !this._visible || this._isUIPointer(event)) return;

            const picked = this._pickEntry(event);
            if (!picked) return;

            this.select(picked.id);
            this._dragging = true;
            this._dragMode = event.shiftKey ? 'rotate' : 'translate';
            this._lastMX = event.clientX;
            this._lastMY = event.clientY;
            this._dragPlane = this._makeDragPlane(picked.root.position);
            this._dragStartPoint = this._intersectPointerPlane(event, this._dragPlane);
            this._dragStartPosition = picked.root.position.clone();
            event.preventDefault();
        }, true);

        document.addEventListener('mouseup', () => {
            this._dragging = false;
            this._dragPlane = null;
            this._dragStartPoint = null;
            this._dragStartPosition = null;
        });

        document.addEventListener('mousemove', event => {
            if (!this._dragging || !this.selectedId) return;

            const entry = this.objects.find(item => item.id === this.selectedId);
            if (!entry) return;

            const dx = event.clientX - this._lastMX;
            const dy = event.clientY - this._lastMY;
            this._lastMX = event.clientX;
            this._lastMY = event.clientY;

            if (this._dragMode === 'rotate' || event.shiftKey) {
                entry.root.rotation.y += dx * 0.01;
                entry.root.rotation.x += dy * 0.01;
            } else {
                const point = this._intersectPointerPlane(event, this._dragPlane);
                if (point && this._dragStartPoint && this._dragStartPosition) {
                    entry.root.position.copy(this._dragStartPosition.clone().add(point.sub(this._dragStartPoint)));
                }
            }

            entry.root.updateMatrixWorld(true);
            event.preventDefault();
        });
    }

    async _loadObject(file, urlMap) {
        const ext = this._extension(file);
        const url = urlMap.get(file.name) || urlMap.get(file.name.toLowerCase());

        console.info(`[ModelImporter] Loading ${file.name} (${ext})`);
        if (ext === 'glb' || ext === 'gltf') return await this._loadGLTF(url, urlMap);
        if (ext === 'obj') return await this._loadOBJ(file, urlMap);
        throw new Error('Format .' + ext + ' tidak didukung.');
    }

    async _loadGLTF(url, urlMap) {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const manager = this._createLoadingManager(urlMap);
        const loader = new GLTFLoader(manager);

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                gltf => {
                    const scene = gltf.scene || gltf.scenes?.[0];
                    if (!scene) {
                        reject(new Error('Tidak ada scene di file GLTF/GLB.'));
                        return;
                    }
                    scene.animations = gltf.animations || [];
                    resolve(scene);
                },
                xhr => {
                    if (xhr.lengthComputable) this.onProgress?.(Math.round(xhr.loaded / xhr.total * 100));
                },
                reject
            );
        });
    }

    async _loadOBJ(file, urlMap) {
        const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
        const manager = this._createLoadingManager(urlMap);
        const loader = new OBJLoader(manager);
        const mtlUrl = this._findMatchingSidecar(file, urlMap, 'mtl');

        if (mtlUrl) {
            try {
                const { MTLLoader } = await import('three/addons/loaders/MTLLoader.js');
                const materials = await new Promise((resolve, reject) => {
                    new MTLLoader(manager).load(mtlUrl, resolve, undefined, reject);
                });
                materials.preload();
                loader.setMaterials(materials);
            } catch (error) {
                console.warn('[ModelImporter] MTL gagal dimuat, lanjut dengan material fallback:', error);
            }
        }

        const url = urlMap.get(file.name) || urlMap.get(file.name.toLowerCase());
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
    }

    _addObject(asset, file, index, total) {
        this._prepareObject(asset);
        const normalized = this._normalizeAsset(asset);
        const entry = this._createEntry(asset, {
            name: file.name,
            type: this._extension(file).toUpperCase(),
            meta: normalized.meta,
            autoScale: normalized.autoScale,
            size: normalized.size,
        });

        const spacing = Math.max(normalized.size.x * 1.3, 4);
        entry.root.position.set((index - (total - 1) / 2) * spacing, 0, 0);
        entry.root.updateMatrixWorld(true);

        this.scene.add(entry.root);
        this.objects.push(entry);
        this._playAnimations(entry);
        this.select(entry.id);
        this._pendingFocus = entry;
        this._visible = true;
        this._canvas.style.display = 'block';

        console.info('[ModelImporter] Object berhasil masuk scene:', this._debugEntry(entry));
        return entry;
    }

    _createEntry(asset, options) {
        const root = new this.THREE.Group();
        const id = `model-${this._idSeq++}`;

        root.name = options.name;
        root.userData.importId = id;
        asset.userData.importId = id;
        root.add(asset);

        return {
            id,
            sourceId: options.sourceId || id,
            name: options.name,
            type: options.type || 'MODEL',
            meta: options.meta || '',
            autoScale: options.autoScale || 1,
            size: options.size || new this.THREE.Vector3(1, 1, 1),
            root,
            asset,
        };
    }

    _prepareObject(object) {
        const fallbackMaterial = new this.THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.55,
            metalness: 0.05,
        });

        let meshCount = 0;
        object.traverse(child => {
            child.visible = true;
            if (child.isMesh || child.isSkinnedMesh) {
                meshCount += 1;
                child.frustumCulled = false;
                child.castShadow = false;
                child.receiveShadow = false;
                if (!child.material) child.material = fallbackMaterial.clone();
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        material.visible = true;
                        material.transparent = material.opacity < 1;
                        material.depthTest = true;
                        material.depthWrite = true;
                        material.needsUpdate = true;
                    });
                }
            }
        });

        if (meshCount === 0) {
            throw new Error('Model tidak memiliki mesh yang bisa dirender.');
        }
    }

    _normalizeAsset(asset) {
        asset.updateMatrixWorld(true);
        let box = new this.THREE.Box3().setFromObject(asset);

        if (box.isEmpty()) {
            console.warn('[ModelImporter] Bounding box kosong. Fallback posisi/scale default dipakai.');
            asset.position.set(0, 0, 0);
            asset.scale.setScalar(1);
            return {
                autoScale: 1,
                size: new this.THREE.Vector3(1, 1, 1),
                meta: 'Size unavailable, fallback scale 1',
            };
        }

        const center = new this.THREE.Vector3();
        const size = new this.THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        let autoScale = 1;
        if (!Number.isFinite(maxDim) || maxDim <= 0) {
            autoScale = 1;
        } else if (maxDim < 2 || maxDim > 40) {
            autoScale = 12 / maxDim;
            asset.scale.multiplyScalar(autoScale);
        }

        // Center after scale so the imported model is guaranteed to land in view.
        asset.position.set(
            -center.x * autoScale,
            -center.y * autoScale,
            -center.z * autoScale
        );

        asset.updateMatrixWorld(true);
        box = new this.THREE.Box3().setFromObject(asset);
        const normalizedSize = new this.THREE.Vector3();
        box.getSize(normalizedSize);

        return {
            autoScale,
            size: normalizedSize,
            meta: `Size ${normalizedSize.x.toFixed(2)} x ${normalizedSize.y.toFixed(2)} x ${normalizedSize.z.toFixed(2)} | scale ${autoScale.toFixed(3)}`,
        };
    }

    async _cloneObject(source) {
        try {
            const { clone } = await import('three/addons/utils/SkeletonUtils.js');
            const cloned = clone(source);
            cloned.animations = source.animations || [];
            this._makeResourcesIndependent(cloned);
            this._prepareObject(cloned);
            return cloned;
        } catch {
            const cloned = source.clone(true);
            cloned.animations = source.animations || [];
            this._makeResourcesIndependent(cloned);
            this._prepareObject(cloned);
            return cloned;
        }
    }

    _makeResourcesIndependent(object) {
        object.traverse(child => {
            if (child.geometry) child.geometry = child.geometry.clone();
            if (!child.material) return;

            const cloneMaterial = material => material.clone();
            child.material = Array.isArray(child.material)
                ? child.material.map(cloneMaterial)
                : cloneMaterial(child.material);
        });
    }

    _playAnimations(entry) {
        const clips = entry.asset.animations || [];
        if (clips.length === 0) return;

        const mixer = new this.THREE.AnimationMixer(entry.root);
        clips.forEach(clip => mixer.clipAction(clip, entry.root).play());
        this._mixers.set(entry.id, mixer);
    }

    _focusMainCamera(mainCam, entry) {
        const distance = Math.max(Math.max(entry.size.x, entry.size.y, entry.size.z) * 4, 35);
        const pos = entry.root.position;
        mainCam.position[0] = pos.x;
        mainCam.position[1] = pos.y;
        mainCam.position[2] = pos.z + distance;
        mainCam.yaw = 0;
        mainCam.pitch = 0;
        mainCam.updateViewMatrix();
        console.info('[ModelImporter] Camera auto-focus:', { camera: [...mainCam.position], target: entry.name });
    }

    _removeEntry(entry) {
        this.scene.remove(entry.root);
        this._dispose(entry.root);
        this._mixers.get(entry.id)?.stopAllAction();
        this._mixers.delete(entry.id);
        this.objects = this.objects.filter(item => item.id !== entry.id);
        if (this.selectedId === entry.id) this.selectedId = this.objects.at(-1)?.id || null;
        console.info('[ModelImporter] Object removed:', entry.name);
    }

    _pickEntry(event) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const hits = this.raycaster.intersectObjects(this.objects.map(item => item.root), true);
        if (hits.length === 0) return null;

        let node = hits[0].object;
        while (node) {
            const id = node.userData?.importId;
            if (id) return this.objects.find(item => item.id === id) || null;
            node = node.parent;
        }
        return null;
    }

    _makeDragPlane(position) {
        const normal = new this.THREE.Vector3();
        this.camera.getWorldDirection(normal);
        return new this.THREE.Plane().setFromNormalAndCoplanarPoint(normal, position);
    }

    _intersectPointerPlane(event, plane) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.raycaster.ray.intersectPlane(plane, new this.THREE.Vector3());
    }

    _createLoadingManager(urlMap) {
        const manager = new this.THREE.LoadingManager();
        manager.setURLModifier(url => {
            const cleanName = decodeURIComponent(url.split('/').pop().split('?')[0]);
            return urlMap.get(cleanName) || urlMap.get(cleanName.toLowerCase()) || url;
        });
        return manager;
    }

    _findMatchingSidecar(file, urlMap, extension) {
        const base = file.name.replace(/\.[^.]+$/, '').toLowerCase();
        for (const [name, url] of urlMap.entries()) {
            if (typeof name === 'string' && name.toLowerCase() === `${base}.${extension}`) return url;
        }
        return null;
    }

    _debugEntry(entry) {
        return {
            id: entry.id,
            name: entry.name,
            position: entry.root.position.toArray().map(v => Number(v.toFixed(3))),
            scale: entry.root.scale.toArray().map(v => Number(v.toFixed(3))),
            size: entry.size.toArray().map(v => Number(v.toFixed(3))),
            meshes: this._countMeshes(entry.root),
        };
    }

    _countMeshes(object) {
        let count = 0;
        object.traverse(child => {
            if (child.isMesh || child.isSkinnedMesh) count += 1;
        });
        return count;
    }

    _validScale(value) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) && Math.abs(parsed) >= 0.001 ? parsed : 1;
    }

    _uniqueName(baseName) {
        const names = new Set(this.objects.map(item => item.name));
        if (!names.has(baseName)) return baseName;
        let index = 2;
        while (names.has(`${baseName} ${index}`)) index += 1;
        return `${baseName} ${index}`;
    }

    _isUIPointer(event) {
        return !!event.target.closest('#left-panel,#left-panel-toggle,#import-panel,#ip-toggle,#perf-overlay');
    }

    _isMainModel(file) {
        return ['gltf', 'glb', 'obj'].includes(this._extension(file));
    }

    _extension(file) {
        return (file.name.split('.').pop() || '').toLowerCase();
    }

    _dispose(object) {
        object.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (!child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
                Object.values(material).forEach(value => {
                    if (value?.isTexture) value.dispose();
                });
                material.dispose();
            });
        });
    }
}
