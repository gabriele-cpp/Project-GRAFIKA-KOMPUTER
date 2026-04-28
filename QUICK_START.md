# 🎮 MINECRAFT-LIKE 3D GRAPHICS ENGINE - Panduan Menjalankan

## ✅ Status Verifikasi: FIXED & READY TO RUN

Masalah yang ada:
- ✅ **FIXED**: `ui/hud.js` file hilang → **DIBUAT**
- ✅ **FIXED**: `ui/bootstrap.js` file hilang → **DIBUAT**
- ✅ **FIXED**: Semua import di main.js terselesaikan
- ✅ **FIXED**: Semua exports di file-file terstruktur dengan baik

---

## 🚀 Quick Start (3 Langkah)

### **1. Buka Terminal/PowerShell**
Navigasi ke folder project:
```powershell
cd "C:\Users\LENOVO\Documents\Miku Miku Beam\Project-GRAFIKA-KOMPUTER"
```

### **2. Start Local Server**
```powershell
python -m http.server 5500
```
Output akan terlihat:
```
Serving HTTP on 0.0.0.0 port 5500 ...
127.0.0.1 - - [28/Apr/2026 ...] "GET / HTTP/1.1" 200 -
```

### **3. Buka di Browser**
Buka URL: **`http://localhost:5500`**

---

## 🎮 Kontrol di Game

| Kontrol | Fungsi |
|---------|--------|
| **W** | Maju |
| **A** | Kiri |
| **S** | Mundur |
| **D** | Kanan |
| **Q** / **Space** | Naik |
| **E** / **Shift** | Turun |
| **↑↓←→** | Look around / Rotate view |
| **Mouse Drag** | Free-look (klik dan drag untuk rotate) |

---

## 📋 Features yang Tersedia

### **🎰 Scene Modes**
- **Random** - Random object distribution
- **Clustered** - Grouped clusters
- **Minecraft (Voxel)** - Grid-based voxel world ⭐ MAIN MODE
- **Dungeon** - Indoor dungeon structures

### **🔧 Culling Algorithms**
- ✅ **Frustum Culling** - Check objects in camera view
- ✅ **Octree Spatial** - Spatial partitioning optimization
- ✅ **Occlusion Culling** - Hide occluded objects
- ✅ **LOD** - Level of Detail based on distance
- ✅ **Temporal Coherence** - Frame-to-frame consistency
- ✅ **Predictive Culling** - Predict future visibility
- ✅ **GPU Instancing** - Batch rendering

### **🎨 Rendering Options**
- Color palettes: Cyber/Neon, Warm, Cool
- Geometry types: Cube, Sphere, Cone, Cylinder, Torus, Icosphere, Plane
- Bounding box visualization
- LOD color mode (highlight LOD levels)
- Occlusion grid overlay

### **📊 Performance Monitoring**
- Real-time FPS display
- Rendered vs Total objects count
- Culling efficiency percentage
- Draw calls tracking
- Vertex count monitoring
- GPU/CPU timing
- Camera position display

### **🔬 Research Features**
- Camera path recording & playback
- Benchmark system
- Benchmark matrix (test multiple configurations)
- Export performance data (JSON/CSV)
- Quality profiles (low/medium/high/ultra)
- Adaptive quality budget

### **📤 Model Import**
- Drag & drop GLTF/GLB models
- OBJ file support
- Instance management (1-100 copies)
- Per-axis scaling
- Translation & rotation controls
- Real-time preview

---

## 📊 Panel Descriptions

### **Left Panel** (Toggle: ◀)
- Object type selector
- Scene generation controls
- Culling method toggles
- Debug visualization options
- Camera speed presets
- Performance metrics
- Export button

### **Research Panel** (Toggle: ⬡)
- Benchmark configuration
- Camera path tools
- Algorithm comparison
- Quality profile selection
- Real-time status updates

### **Import Panel** (Toggle: ▶)
- Model import interface
- Instance duplication
- Scaling & transformation
- Model deletion
- Object registry

### **Performance Dashboard** (📊)
- Real-time graphs
- FPS over time
- Object count trends
- Culling efficiency chart
- GPU timing graph

---

## 🎯 Example Workflows

### **Workflow 1: Explore Voxel World**
1. Start server
2. Open http://localhost:5500
3. Select mode: **"Voxel (Minecraft-like)"**
4. Click **"Generate Scene"**
5. Use WASD + Mouse to explore
6. Toggle different culling algorithms di left panel

### **Workflow 2: Performance Benchmark**
1. Generate a complex scene
2. Open Research Panel
3. Record camera path (explore the scene)
4. Click "Start Benchmark"
5. Export results as JSON

### **Workflow 3: Import Custom Model**
1. Open Import Panel
2. Drag & drop a GLTF/GLB file
3. Generate instances (10-100x)
4. Adjust scale & position
5. Watch performance impact

### **Workflow 4: Culling Comparison**
1. Generate scene with ~10,000 objects
2. Toggle each culling method one by one
3. Compare FPS & efficiency % in left panel
4. Export performance snapshot

---

## 🐛 Troubleshooting

### **"Blank Screen"**
- Check browser console (F12 → Console)
- Ensure WebGL is enabled
- Try a different browser (Chrome/Firefox/Edge)

### **"Server not running"**
- Ensure python is installed: `python --version`
- Try: `python3 -m http.server 5500`
- Or use: `npx http-server` (if Node.js installed)

### **"Low FPS"**
- Reduce object count (Scene Control → Objects slider)
- Enable GPU Instancing (Culling Methods)
- Switch to lower complexity preset
- Close browser tabs

### **"Models not loading"**
- Check browser console for errors
- Ensure file is valid GLTF/GLB/OBJ
- Try with included models first

### **"WASD not working"**
- Required: Click canvas first to focus
- Check keyboard layout (non-US keyboards may differ)
- Use arrow keys as alternative

---

## 📁 Project Structure

```
Project-GRAFIKA-KOMPUTER/
├── index.html          (Web page entry)
├── main.js             (Game loop & orchestration)
├── style.css           (UI styling)
├── engine/             (3D graphics components)
│   ├── renderer.js     (WebGL context)
│   ├── shader.js       (GLSL shaders)
│   ├── camera.js       (View matrix)
│   ├── mesh.js         (Geometry data)
│   ├── geometry.js     (Shape generators)
│   ├── performance.js  (FPS/timing monitor)
│   ├── benchmark.js    (Benchmark runner)
│   ├── adaptive-quality.js (FPS budgeting)
│   ├── camera-path.js  (Replay system)
│   ├── model-importer.js (GLTF/OBJ loader)
│   └── model-loader.js (THREE.js loader wrapper)
├── culling/            (Visibility determination)
│   ├── frustum.js      (Camera frustum)
│   ├── octree.js       (Space partitioning)
│   ├── lod.js          (Distance-based detail)
│   ├── occlusion.js    (Depth-based hiding)
│   └── hybrid-pipeline.js (Master culling algorithm)
├── ui/                 (User interface panels)
│   ├── hud.js          (⭐ NEWLY CREATED - HUD overlay)
│   ├── bootstrap.js    (⭐ NEWLY CREATED - UI wiring)
│   ├── left-panel.js   (Feature controls)
│   ├── research-panel.js (Benchmark tools)
│   ├── import-panel.js (Model import)
│   ├── chart-panel.js  (Performance graphs)
│   └── chart-panel.html (Chart HTML)
├── objects/            (Scene generation)
│   ├── objects.js      (Object factory)
│   └── scene-generator.js (Preset scenes)
└── VERIFICATION_REPORT.md
```

---

## ✨ Key Technologies

- **WebGL 2.0** - Hardware-accelerated 3D graphics
- **JavaScript ES6 Modules** - Code organization
- **GLSL** - Vertex/fragment shaders
- **Three.js** - Model loading (GLTF/GLB/OBJ)
- **HTML5 Canvas** - Rendering target
- **Chart.js** - Performance visualization

---

## 🎓 Optimization Concepts Demonstrated

1. **Spatial Partitioning** - Octree for fast culling
2. **Frustum Culling** - Only render visible objects
3. **Occlusion Culling** - Skip hidden objects
4. **LOD System** - Reduce detail for distant objects
5. **Instancing** - Batch render identical objects
6. **Temporal Coherence** - Reuse visibility from previous frames
7. **Predictive Culling** - Preemptively cull based on motion
8. **GPU Optimization** - Minimize draw calls

---

## 📞 Support

- Check browser console (F12) for error logs
- Look at VERIFICATION_REPORT.md for detailed fixes
- Ensure all .js files are present (20 files total)
- Verify port 5500 is not in use: `netstat -an | find "5500"`

---

**Status: ✅ READY TO PLAY**

Selamat menikmati Minecraft-like 3D graphics engine! 🚀


