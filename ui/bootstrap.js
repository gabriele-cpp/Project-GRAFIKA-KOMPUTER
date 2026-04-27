export function mountUI({
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
}) {
    modelImporter.onLoad = (filename, meta, autoScale) => {
        importPanel.setModelLoaded(filename, meta);
        if (autoScale != null) importPanel.syncScale(autoScale);
        showToast(`"${filename}" loaded into scene.`);
    };
    modelImporter.onError = message => showToast(message);
    modelImporter.onProgress = percent => importPanel.setProgress(percent);
    modelImporter.onRegistryChange = (objects, event) => {
        syncImportedRegistry(objects, event?.selectedId ?? null);
        syncSceneUI();
    };

    leftPanel.mount({
        onObjType: type => {
            setGeometryType(type);
            showToast(`Geometry changed to ${type.toUpperCase()}.`);
        },
        onObjCount: count => {
            state.objectCount = count;
            regenerateObjects();
        },
        onMode: mode => {
            state.mode = mode;
            leftPanel.syncSceneControls({ mode: state.mode });
            regenerateObjects();
        },
        onPalette: index => {
            state.paletteIdx = index;
            leftPanel.syncSceneControls({ paletteIdx: state.paletteIdx });
            regenerateObjects();
        },
        onGenerate: regenerateObjects,
        onGenerateEnvironment: () => generateComplexityPreset(state.complexity),
        onClearGeneratedScene: clearGeneratedScene,
        onStateChange: (key, value) => {
            state[key] = value;
            leftPanel.syncState(state);
            researchPanel.syncState(state);
        },
        onExportJSON: exportPerformanceJSON,
        onChartPanel: () => chartPanel.toggle(),
        onCameraSpeed: value => setCameraSpeed(value),
        onCameraTurnSpeed: value => setCameraTurnSpeed(value),
    });
    leftPanel.syncState(state);
    leftPanel.syncSceneControls({
        count: state.objectCount,
        mode: state.mode,
        paletteIdx: state.paletteIdx,
    });

    researchPanel.mount({
        onToggleState: (key, value) => {
            state[key] = value;
            leftPanel.syncState(state);
            researchPanel.syncState(state);
        },
        onGenerateComplexity: level => generateComplexityPreset(level),
        onRecord: () => {
            cameraPath.startRecording(`${state.environmentLabel}-${Date.now()}`);
            showToast('Camera path recording started.');
        },
        onStopRecord: () => {
            cameraPath.stopRecording();
            showToast('Camera path recording stopped.');
        },
        onReplay: () => {
            if (!cameraPath.startReplay(cameraPath.recordedPath, {
                loop: false,
                smoothing: state.cameraPathSmoothing,
                constantSpeed: state.cameraPathConstantSpeed,
            })) {
                showToast('No camera path available.');
            }
        },
        onSetOcclusionResolution: value => {
            state.occlusionResolution = value;
        },
        onSetLodThresholds: ({ near, mid, far, transitionBand }) => {
            if (near != null) state.lodNear = near;
            if (mid != null) state.lodMid = mid;
            if (far != null) state.lodFar = far;
            if (transitionBand != null) state.lodTransitionBand = transitionBand;
        },
        onSetReplayOptions: ({ smoothing, constantSpeed }) => {
            if (typeof smoothing === 'boolean') state.cameraPathSmoothing = smoothing;
            if (typeof constantSpeed === 'boolean') state.cameraPathConstantSpeed = constantSpeed;
        },
        onSetSceneSeed: seed => {
            state.sceneSeed = seed;
        },
        onExportPath: exportCameraPath,
        onImportPath: importPath,
        onStartBenchmark: startBenchmark,
        onStartBenchmarkMatrix: startBenchmarkMatrix,
        onExportBenchmark: exportBenchmark,
    });
    researchPanel.syncState(state);

    importPanel.mount({
        onUpload: files => modelImporter.loadFiles(files),
        onRemove: () => {
            modelImporter.remove();
            if (modelImporter.objects.length === 0) importPanel.reset();
            showToast('Imported model removed.');
        },
        onInstanceCount: count => modelImporter.setInstanceCount(count),
        onScale: ({ x, y, z }) => modelImporter.setScale(x, y, z),
        onSelectObject: id => modelImporter.select(id),
        onDuplicateObject: async id => {
            const newId = await modelImporter.duplicate(id);
            if (newId) showToast('Imported object duplicated.');
        },
        onRemoveObject: id => {
            modelImporter.remove(id);
            if (modelImporter.objects.length === 0) importPanel.reset();
            showToast('Imported object removed.');
        },
        onError: message => showToast(message),
        onTransformOptions: options => modelImporter.setTransformOptions(options),
    });
}
