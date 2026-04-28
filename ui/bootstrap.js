// ============================================================
// ui/bootstrap.js
//
// UI Bootstrap: Mount dan wire semua UI panels dengan callbacks.
// Ini adalah orchestrator yang menghubungkan:
//   - LeftPanel (scene generation, geometry, performance)
//   - ResearchPanel (benchmark, camera path, quality settings)
//   - ImportPanel (model import, instance management)
//   - ChartPanel (performance visualization)
// ============================================================

export function mountUI(options) {
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
  } = options;

  // ─── LEFT PANEL Wiring ───────────────────────────────
  if (leftPanel) {
    // Object type buttons
    leftPanel.onGeometryChange?.((type) => {
      setGeometryType(type);
    });

    // Scene regeneration
    leftPanel.onSceneGenerate?.((config) => {
      if (config.mode !== undefined) state.mode = config.mode;
      if (config.count !== undefined) state.objectCount = config.count;
      if (config.palette !== undefined) state.paletteIdx = config.palette;
      if (config.seed !== undefined) state.sceneSeed = config.seed;
      regenerateObjects();
    });

    // Clear scene
    leftPanel.onSceneClear?.(() => {
      clearGeneratedScene();
      showToast?.('Scene cleared.');
    });

    // Complexity presets
    leftPanel.onComplexitySelect?.((level) => {
      generateComplexityPreset(level);
    });

    // Culling toggles
    leftPanel.onStateChange?.((updates) => {
      Object.assign(state, updates);
      syncSceneUI();
    });

    // Camera speed
    leftPanel.onCameraSpeedChange?.((speed) => {
      setCameraSpeed?.(speed);
    });

    // Camera turn speed
    leftPanel.onCameraTurnSpeedChange?.((speed) => {
      setCameraTurnSpeed?.(speed);
    });

    // Export performance
    leftPanel.onExportPerformance?.(() => {
      exportPerformanceJSON();
    });
  }

  // ─── RESEARCH PANEL Wiring ──────────────────────────
  if (researchPanel) {
    // Record camera path
    researchPanel.onRecordPath?.(() => {
      if (!cameraPath.recording) {
        cameraPath.startRecording();
        showToast?.('Camera path recording started.');
      } else {
        cameraPath.stopRecording();
        showToast?.(`Camera path recorded (${cameraPath.recordedPath?.samples?.length || 0} samples).`);
      }
    });

    // Export camera path
    researchPanel.onExportPath?.(() => {
      exportCameraPath();
    });

    // Import camera path
    researchPanel.onImportPath?.((raw) => {
      importPath(raw);
    });

    // Start benchmark
    researchPanel.onBenchmarkStart?.(() => {
      startBenchmark();
    });

    // Start benchmark matrix
    researchPanel.onBenchmarkMatrixStart?.(() => {
      startBenchmarkMatrix();
    });

    // Export benchmark
    researchPanel.onBenchmarkExport?.((format) => {
      exportBenchmark(format);
    });

    // Culling algorithm toggle
    researchPanel.onAlgorithmToggle?.((key, enabled) => {
      if (key === 'frustum') state.useFrustum = enabled;
      else if (key === 'octree') state.useOctree = enabled;
      else if (key === 'occlusion') state.useOcclusion = enabled;
      else if (key === 'lod') state.useLOD = enabled;
      else if (key === 'temporal') state.useTemporalCoherence = enabled;
      else if (key === 'predictive') state.usePredictiveCulling = enabled;
      syncSceneUI();
    });

    // Quality profile
    researchPanel.onQualityChange?.((profile) => {
      state.qualityProfile = profile;
      syncSceneUI();
    });
  }

  // ─── IMPORT PANEL Wiring ────────────────────────────
  if (importPanel) {
    // Model import handler
    importPanel.onModelImport?.((file) => {
      modelImporter?.loadModel?.(file)
        .then((result) => {
          if (result) {
            const instances = modelImporter?.generateInstances?.(result);
            if (instances) {
              syncImportedRegistry?.(instances, result.id);
              showToast?.(`Model imported: ${result.name} (${instances.length} instances).`);
              syncSceneUI?.();
            }
          }
        })
        .catch((error) => {
          showToast?.(`Import failed: ${error.message}`);
        });
    });

    // Model delete
    importPanel.onModelDelete?.((id) => {
      modelImporter?.deleteModel?.(id);
      syncImportedRegistry?.([]);
      showToast?.('Model deleted.');
      syncSceneUI?.();
    });

    // Instance count change
    importPanel.onInstanceCountChange?.((id, count) => {
      modelImporter?.setInstanceCount?.(id, count);
      syncSceneUI?.();
    });
  }

  // ─── CHART PANEL Wiring ─────────────────────────────
  if (chartPanel) {
    // Chart panel typically auto-updates via chartPanel.update() call
    // in gameLoop, so minimal wiring needed here
  }

  // ─── Additional auto-sync ───────────────────────────
  // Sync UI with current state on initialization
  syncSceneUI?.();
}

