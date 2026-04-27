function clamp(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
}

export function mountUI(context) {
    const {
        state,
        leftPanel,
        researchPanel,
        importPanel,
        chartPanel,
        modelImporter,
        cameraPath,
        showToast,
        syncImportedRegistry,
        syncSceneUI,
        setGeometryType,
        regenerateObjects,
        generateComplexityPreset,
        clearGeneratedScene,
        exportPerformanceJSON,
        exportCameraPath,
        importPath,
        startBenchmark,
        startBenchmarkMatrix,
        exportBenchmark,
        setCameraSpeed,
        setCameraTurnSpeed,
    } = context;

    leftPanel.mount({
        onObjType: type => {
            setGeometryType(type);
            showToast(`Geometry: ${type}`);
        },
        onObjCount: count => {
            state.objectCount = Math.max(0, Number.parseInt(count, 10) || 0);
            regenerateObjects();
        },
        onMode: mode => {
            state.mode = mode;
            regenerateObjects();
        },
        onPalette: paletteIdx => {
            state.paletteIdx = Math.max(0, Number.parseInt(paletteIdx, 10) || 0);
            regenerateObjects();
        },
        onGenerate: () => regenerateObjects(),
        onStateChange: (key, value) => {
            state[key] = value;
        },
        onExportJSON: () => exportPerformanceJSON(),
        onChartPanel: () => chartPanel.toggle(),
        onCameraSpeed: value => setCameraSpeed(value),
        onCameraTurnSpeed: value => setCameraTurnSpeed(value),
    });

    researchPanel.mount({
        onToggleState: (key, value) => {
            state[key] = value;
        },
        onSetOcclusionResolution: value => {
            state.occlusionResolution = Math.round(clamp(value, 8, 64));
        },
        onSetLodThresholds: ({ near, mid, far, transitionBand } = {}) => {
            if (Number.isFinite(near)) state.lodNear = clamp(near, 20, 600);
            if (Number.isFinite(mid)) state.lodMid = clamp(mid, state.lodNear + 20, 1200);
            if (Number.isFinite(far)) state.lodFar = clamp(far, state.lodMid + 20, 1800);
            if (Number.isFinite(transitionBand)) state.lodTransitionBand = clamp(transitionBand, 4, 200);
        },
        onSetReplayOptions: ({ smoothing, constantSpeed } = {}) => {
            state.cameraPathSmoothing = !!smoothing;
            state.cameraPathConstantSpeed = !!constantSpeed;
            cameraPath.replaySmoothing = !!smoothing;
            cameraPath.replayConstantSpeed = !!constantSpeed;
        },
        onSetSceneSeed: seed => {
            const parsed = Number.parseInt(seed, 10);
            if (Number.isFinite(parsed)) state.sceneSeed = parsed;
        },
        onGenerateComplexity: level => {
            generateComplexityPreset(level || 'medium');
        },
        onRecord: () => {
            cameraPath.startRecording(`path-${Date.now()}`);
            showToast('Camera path recording started.');
        },
        onStopRecord: () => {
            const path = cameraPath.stopRecording();
            const sampleCount = path?.samples?.length || 0;
            showToast(`Recording stopped (${sampleCount} samples).`);
        },
        onReplay: () => {
            const ok = cameraPath.startReplay(cameraPath.recordedPath, {
                loop: false,
                smoothing: state.cameraPathSmoothing,
                constantSpeed: state.cameraPathConstantSpeed,
            });
            if (!ok) showToast('Record or import a camera path first.');
        },
        onExportPath: () => exportCameraPath(),
        onImportPath: raw => importPath(raw),
        onStartBenchmark: () => startBenchmark(),
        onStartBenchmarkMatrix: () => startBenchmarkMatrix(),
        onExportBenchmark: format => exportBenchmark(format),
    });

    modelImporter.onProgress = value => importPanel.setProgress(value);
    modelImporter.onLoad = (filename, meta, autoScale = 1) => {
        importPanel.setModelLoaded(filename, meta);
        importPanel.syncScale(autoScale);
        showToast(`Imported: ${filename}`);
    };
    modelImporter.onError = message => showToast(message);
    modelImporter.onRegistryChange = (objects, metadata = {}) => {
        syncImportedRegistry(objects, metadata.selectedId ?? null);
        syncSceneUI();
        if (!objects.length) importPanel.reset();
    };

    importPanel.mount({
        onUpload: files => modelImporter.loadFiles(files),
        onRemove: () => modelImporter.remove(),
        onInstanceCount: count => modelImporter.setInstanceCount(count),
        onScale: ({ x, y, z }) => modelImporter.setScale(x, y, z),
        onTransformOptions: options => modelImporter.setTransformOptions(options),
        onSelectObject: id => modelImporter.select(id),
        onDuplicateObject: id => modelImporter.duplicate(id),
        onRemoveObject: id => modelImporter.remove(id),
        onError: message => showToast(message),
    });

    document.addEventListener('keydown', event => {
        if (!event.ctrlKey || !event.shiftKey) return;
        const key = event.key.toLowerCase();
        if (key === 'p') {
            event.preventDefault();
            chartPanel.toggle();
        }
        if (key === 'x') {
            event.preventDefault();
            clearGeneratedScene();
            showToast('Generated scene cleared.');
        }
    });

    leftPanel.syncSceneControls?.({
        count: state.objectCount,
        mode: state.mode,
        paletteIdx: state.paletteIdx,
    });
    leftPanel.syncState?.(state);
    researchPanel.syncState?.(state);
    importPanel.setObjectRegistry?.([], null);
}

