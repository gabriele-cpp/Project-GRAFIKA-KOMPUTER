# 3D Game Simulator with Hybrid Culling 2.0

Research project for real-time 3D rendering in WebGL with a focus on:

- Octree spatial partitioning
- Frustum culling
- Screen-space occlusion culling
- Temporal coherence and predictive visibility reuse
- Automated benchmarking, replay, and export

## Current Scope

This repository now implements the research/evaluation core for the thesis topic:

`3D Game Simulator with Real-Time Rendering Optimization using Hybrid Culling`

Implemented in code:

- Feature 1: Adaptive Hybrid Culling Pipeline 2.0
- Feature 7: Predictive culling heuristic
- Feature 8: Adaptive GPU budget manager
- Feature 9: Live performance dashboard
- Feature 10: Camera path recorder and replay
- Feature 11: Automated benchmark exporter
- Feature 12: Multi-complexity scene generator
- Feature 13: Heatmap visualization
- Feature 14: Camera benchmark mode with 6 technique presets
- WebGL 1.0 / 2.0 renderer fallback

Planned next-phase extensions:

- Feature 2: true GPU Hi-Z occlusion
- Feature 3: native WebGL instancing path for generated meshes
- Feature 4: fully GPU-driven LOD selection
- Feature 5: Cook-Torrance PBR
- Feature 6: shadow mapping with PCF
- Feature 15: glTF + Draco streaming path

## Architecture

```text
Camera/Input
    |
    v
CameraPathSystem <---- BenchmarkRunner ----> JSON / CSV export
    |
    v
HybridCullingPipeline
    |
    +-- Stage 1: Octree + Frustum pruning
    +-- Stage 2: Temporal reuse + predictive visibility ordering
    +-- Stage 3: Screen-space occlusion culling
    +-- Stage 4: Smooth distance-based LOD
    |
    v
Renderer + ModelImporter overlay
    |
    v
PerformanceMonitor -> ChartPanel / LeftPanel / ResearchPanel
```

## Hybrid 2.0 Pseudocode

```text
for each frame:
  update camera
  update frustum planes
  octree_query -> visible node candidates
  frustum_filter imported objects
  temporal_reuse(previous_visibility)
  predictive_sort(camera_motion, history)
  for candidate in sorted candidates:
    if occluded in screen-space depth grid: cull
    if outside LOD budget: cull
    else render and register as occluder
  record stage timings and visibility statistics
```

## Benchmark Data Flow

```text
Record camera path
    -> Replay identical path
    -> Run 6 technique presets
    -> Capture per-frame metrics
    -> Aggregate averages
    -> Export JSON + CSV
    -> Plot comparative graphs
```

## Feature Matrix

| ID | Concept | Code / Integration | Metrics |
|----|---------|--------------------|---------|
| 1 | Hierarchical Hybrid 2.0 combines octree, frustum, predictive reuse, occlusion, and LOD in one pipeline. It reduces unnecessary per-object tests and exposes per-stage timings for analysis. | `culling/hybrid-pipeline.js` integrated in `main.js` render loop. Uses `octree.js`, `frustum.js`, `occlusion.js`, `lod.js`. | Spatial ms, predictive ms, occlusion ms, LOD ms, visible count, frustum-culled count, reuse count, predicted count. |
| 7 | Predictive culling estimates future visibility from camera motion and previous frame visibility. This lowers expensive late-stage tests for likely-visible objects. | Implemented inside `HybridCullingPipeline` and controlled from `ui/research-panel.js`. | Predicted-visible count, FPS delta with predictor on/off, occlusion test reduction. |
| 8 | Adaptive quality keeps frame rate near target by tightening LOD distance and occlusion resolution. This stabilizes FPS during dense scenes and replay benchmarks. | `engine/adaptive-quality.js`, applied in `main.js`. | Target FPS error, profile transitions, average FPS, frame-time variance. |
| 9 | Live dashboard provides real-time experimental observability instead of only visual output. This makes the simulator usable for repeatable research runs. | `engine/performance.js`, `ui/chart-panel.js`, `ui/left-panel.js`, `ui/research-panel.js`. | FPS, CPU ms, GPU ms if supported, draw calls, rendered/culled counts, vertex count, octree depth. |
| 10 | Camera recording and replay guarantee identical motion across experiments. This removes camera path bias from technique comparisons. | `engine/camera-path.js` with controls in `ui/research-panel.js`. | Path duration, sample count, replay completion, path reproducibility. |
| 11 | Automated benchmark mode runs predefined technique presets over the same path and exports frame logs. This supports paper-quality tables and plots. | `engine/benchmark.js`, triggered from `main.js` and `ui/research-panel.js`. | Average FPS, draw calls, frame time, vertex count, cull efficiency per technique. |
| 12 | Scene complexity presets generate low/medium/high workloads with controlled spatial density and occluder structure. This enables scalability testing. | `objects/scene-generator.js` integrated into `main.js`. | FPS vs complexity, draw calls vs object count, octree depth vs scene complexity. |
| 13 | Heatmap visualization colors rendered and culled objects by culling reason. This helps validate whether the pipeline behaves as expected. | `main.js` debug overlay using bounding boxes. | Visible count, frustum-cull count, occlusion-cull count, LOD-cull count. |
| 14 | Benchmark mode compares Baseline, Frustum, Occlusion, LOD, Hybrid, and Hybrid 2.0 on the same path. This isolates contribution per technique. | `engine/benchmark.js` technique presets. | FPS improvement %, draw-call reduction %, culling efficiency %, stage-time breakdown. |

## Experimental Modes

The benchmark runner currently compares:

1. No Optimization
2. Frustum Only
3. Occlusion Only
4. LOD Only
5. Hybrid
6. Hybrid 2.0

## Suggested Evaluation Table

| Scene | Technique | Avg FPS | Avg CPU ms | Avg GPU ms | Draw Calls | Vertex Count | Culled % | Spatial ms | Occlusion ms |
|-------|-----------|---------|------------|------------|------------|--------------|----------|------------|--------------|
| Low | Baseline | | | | | | | | |
| Low | Hybrid 2.0 | | | | | | | | |
| Medium | Baseline | | | | | | | | |
| Medium | Hybrid 2.0 | | | | | | | | |
| High | Baseline | | | | | | | | |
| High | Hybrid 2.0 | | | | | | | | |

## Recommended Graphs

- FPS vs technique
- Draw calls vs object count
- Culling efficiency vs scene complexity
- Stage time breakdown for Hybrid vs Hybrid 2.0
- Frame time over replay path

## File Map

```text
index.html
main.js
engine/
  adaptive-quality.js
  benchmark.js
  camera-path.js
  performance.js
  renderer.js
culling/
  frustum.js
  hybrid-pipeline.js
  lod.js
  occlusion.js
  octree.js
objects/
  scene-generator.js
ui/
  chart-panel.js
  left-panel.js
  research-panel.js
```

## WebGL Compatibility

- Renderer falls back from WebGL 2.0 to WebGL 1.0 automatically.
- GPU timer queries are used when supported and ignored otherwise.
- Occlusion operates with a CPU screen-space depth grid fallback.
- Imported objects continue to render through the Three.js overlay path.

## Known Gaps

- Hi-Z occlusion is currently approximated by a CPU screen-space depth grid, not a full GPU depth pyramid.
- Generated-object instancing is not yet wired into a dedicated instanced draw path.
- PBR, soft shadows, and Draco loading are reserved for the next implementation phase.

## Run / Research Workflow

1. Generate a low, medium, or high complexity scene from the Research Lab panel.
2. Record a camera path.
3. Replay it once to validate the route.
4. Run the 6-technique benchmark.
5. Export JSON and CSV.
6. Build tables and graphs for the paper/report.
