# 3D Simulator — Hybrid Spatial-Occlusion Culling

**Judul Penelitian:** Simulator Game 3D dengan Optimasi Culling dan Rendering Real-Time  
**Tim:** Dheavanda Wijaya, Gabriel Emil, Kenny Lay

---

## Novelty Utama

> *"Implementasi Hybrid Spatial-Occlusion Culling menggunakan struktur Octree dinamis yang dioptimasi untuk lingkungan WebGL."*

Menggabungkan teknik dari jurnal **Octree-GS** (spasial) dan **OccluGaussian** (oklusi), diadaptasi untuk keterbatasan WebGL tanpa GPU high-end.

---

## Struktur Folder

```
simulator-3d/
├── index.html              # Entry point + UI panel lengkap
├── main.js                 # Game loop + pipeline rendering
├── style.css               # Modern dark UI (Exo 2 + Share Tech Mono)
│
├── engine/
│   ├── math.js             # mat4, vec3 utilities (dari kode asli + tambahan vec3)
│   ├── camera.js           # FPS camera + forward vector (dari kode asli + getter)
│   ├── mesh.js             # Cube mesh dengan normal (dari kode asli, tidak diubah)
│   ├── renderer.js         # WebGL context + depth test (dari kode asli + depth enable)
│   └── shader.js           # Shader compiler/linker (dari kode asli, tidak diubah)
│
├── culling/
│   ├── frustum.js          # View Frustum Culling (dari kode asli, tidak diubah)
│   ├── octree.js           ⭐ BARU — Dynamic Octree spatial partitioning
│   ├── lod.js              ⭐ BARU — Level of Detail berbasis jarak kamera
│   └── occlusion.js        ⭐ BARU — Hybrid Occlusion Estimation
│
└── objects/
    └── objects.js          ⭐ DIMODIFIKASI — Procedural generator + clustering
```

---

## Pipeline Rendering (Baru)

```
Frame N:
  1. Camera update (WASD + mouse drag)
  2. Frustum planes update
  3. Octree.queryFrustum(frustum) → candidate list     [O(log n)]
  4. Per-candidate:
      a. OcclusionCuller.shouldRender()                 [back-face + proximity]
      b. LOD.getLevel(distance)                         [scale + cull far objects]
  5. Render objects yang lolos + update stats
```

### Perbandingan dengan Kode Asli

| Aspek | Kode Asli | Kode Baru |
|-------|-----------|-----------|
| Frustum Culling | ✅ (O(n) per frame) | ✅ (O(log n) via Octree) |
| Occlusion Culling | ❌ (file kosong) | ✅ Proximity estimation |
| Level of Detail | ❌ (file kosong) | ✅ 3 level berbasis jarak |
| Octree | ❌ | ✅ Dynamic octree (depth 5) |
| Debug Visualization | ❌ | ✅ Bounding box + LOD color |
| UI | Checkbox sederhana | Modern floating panel |
| Object Generation | 50.000 kubus statis | Prosedural + clustered |
| Model Upload | ❌ | ✅ GLTF/OBJ placeholder |

---

## Cara Kerja Sistem Culling

### 1. View Frustum Culling (Kode Asli — Dipertahankan)
Mengekstrak 6 bidang dari matriks proyeksi×view. Setiap objek dicek apakah bounding sphere-nya bersinggungan dengan frustum. Jika tidak → di-cull.

### 2. Octree Spatial Partitioning (Baru — NOVELTY)
- Dunia dibagi menjadi hierarki node 3D (tiap node = 8 oktan anak)
- Saat frustum culling, traverse hanya node yang **bersinggungan** dengan frustum
- Node yang seluruhnya di luar frustum → seluruh subtree di-skip
- Kompleksitas: **O(log n)** vs O(n) tanpa octree

### 3. Occlusion Culling (Baru)
Estimasi dua tahap (adaptasi dari OccluGaussian untuk WebGL):
- **Back-face cull**: objek di belakang kamera langsung di-cull (dot product)
- **Proximity occlusion**: objek yang berdekatan dengan occluder lebih dekat → di-cull

### 4. Level of Detail (Baru)
Berdasarkan jarak kamera:
- `< 150` = Full detail (scale 1.0, warna normal)
- `< 350` = Medium detail (scale 0.85, warna kuning di debug mode)
- `< 600` = Low detail (scale 0.55, warna merah di debug mode)
- `>= 600` = Culled (tidak dirender sama sekali)

---

## Kontrol Keyboard

| Key | Aksi |
|-----|------|
| W/A/S/D | Maju/mundur/kiri/kanan |
| Q / Space | Naik |
| E / Shift | Turun |
| ← → ↑ ↓ | Putar kamera |
| Mouse click+drag | Look around |

---

## Referensi Jurnal

1. **OccluGaussian** (ICCV 2025) — occlusion-aware scene division
2. **Octree-GS** (IEEE TPAMI 2024) — LOD via dynamic octree
3. **Real-Time LOD for GPU** (IEEE TVCG 2025) — adaptive LOD
4. **Shadow/Occlusion AR** (IEEE ISMAR 2023) — dynamic occlusion culling
