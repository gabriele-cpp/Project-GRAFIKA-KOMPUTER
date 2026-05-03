// ============================================================
// ui/hud.js
//
// HUD Overlay system:
//   - FPS counter (auto-updates from updateStats)
//   - Toast notifications (temporary)
//   - Stats panel updates (rendered, total, culled, efficiency)
// ============================================================

export class HudOverlay {
  constructor() {
    this.toastEl = document.getElementById('toast');
    this.fpsEl = document.getElementById('stat-fps');
    this.renderedEl = document.getElementById('stat-rendered');
    this.totalEl = document.getElementById('stat-total');
    this.culledEl = document.getElementById('stat-culled');
    this.efficiencyEl = document.getElementById('stat-eff');
    this.cullingBreakdownF = document.getElementById('stat-cF');
    this.cullingBreakdownO = document.getElementById('stat-cO');
    this.cullingBreakdownL = document.getElementById('stat-cL');
    this.perfSpatialEl   = document.getElementById('stat-perf-spatial');
    this.perfOcclusionEl = document.getElementById('stat-perf-occlusion');
    this.perfLodEl       = document.getElementById('stat-perf-lod');

    this.toastTimeout = null;
    this.setupStyles();
  }

  setupStyles() {
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        #toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 200, 255, 0.95);
          color: #000;
          padding: 12px 24px;
          border-radius: 6px;
          font-family: 'Exo 2', sans-serif;
          font-size: 0.9rem;
          z-index: 999;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0, 200, 255, 0.5);
        }
        #toast.show {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }
  }

  showToast(message) {
    if (!this.toastEl) return;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');

    this.toastTimeout = setTimeout(() => {
      this.toastEl?.classList.remove('show');
    }, 3000);
  }

  updateStats(stats) {
    if (!stats) return;

    // Update FPS
    if (this.fpsEl) {
      this.fpsEl.textContent = Math.round(stats.fps || 0);
    }

    // Update rendered/total/culled
    if (this.renderedEl) {
      this.renderedEl.textContent = stats.drawn || 0;
    }
    if (this.totalEl) {
      this.totalEl.textContent = stats.total || 0;
    }
    if (this.culledEl) {
      const culled = Math.max(0, (stats.total || 0) - (stats.drawn || 0));
      this.culledEl.textContent = culled;
    }

    // Update efficiency %
    if (this.efficiencyEl && stats.total > 0) {
      const eff = Math.round((stats.drawn / stats.total) * 100);
      this.efficiencyEl.textContent = eff + '%';
    }

    // Update culling breakdown if stageStats available
    if (stats.stageStats) {
      const ss = stats.stageStats;
      if (this.cullingBreakdownF) this.cullingBreakdownF.textContent = ss.frustumCulled || 0;
      if (this.cullingBreakdownO) this.cullingBreakdownO.textContent = ss.occlusionCulled || 0;
      if (this.cullingBreakdownL) this.cullingBreakdownL.textContent = ss.lodCulled || 0;
      if (this.perfSpatialEl)   this.perfSpatialEl.textContent   = (ss.spatialMs   || 0).toFixed(2) + 'ms';
      if (this.perfOcclusionEl) this.perfOcclusionEl.textContent = (ss.occlusionMs || 0).toFixed(2) + 'ms';
      if (this.perfLodEl)       this.perfLodEl.textContent       = (ss.lodMs       || 0).toFixed(2) + 'ms';
    }
  }
}

