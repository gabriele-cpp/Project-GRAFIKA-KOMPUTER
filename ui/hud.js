export class HudOverlay {
    constructor() {
        this.elements = {
            fps: document.getElementById('stat-fps'),
            rendered: document.getElementById('stat-rendered'),
            total: document.getElementById('stat-total'),
            culled: document.getElementById('stat-culled'),
            efficiency: document.getElementById('stat-eff'),
            frustum: document.getElementById('stat-cF'),
            occlusion: document.getElementById('stat-cO'),
            lod: document.getElementById('stat-cL'),
            toast: document.getElementById('toast'),
        };
        this.toastTimer = null;
    }

    updateStats({ fps = 0, drawn = 0, total = 0, stageStats = null } = {}) {
        const culled = Math.max(0, total - drawn);
        const efficiency = total > 0 ? Math.round((culled / total) * 100) : 0;

        if (this.elements.fps) {
            this.elements.fps.textContent = fps;
            this.elements.fps.style.color = fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444';
        }
        if (this.elements.rendered) this.elements.rendered.textContent = drawn.toLocaleString();
        if (this.elements.total) this.elements.total.textContent = total.toLocaleString();
        if (this.elements.culled) this.elements.culled.textContent = culled.toLocaleString();
        if (this.elements.efficiency) this.elements.efficiency.textContent = `${efficiency}%`;
        if (this.elements.frustum) this.elements.frustum.textContent = (stageStats?.frustumCulled || 0).toLocaleString();
        if (this.elements.occlusion) this.elements.occlusion.textContent = (stageStats?.occlusionCulled || 0).toLocaleString();
        if (this.elements.lod) this.elements.lod.textContent = (stageStats?.lodCulled || 0).toLocaleString();
    }

    showToast(message) {
        if (!this.elements.toast) return;
        this.elements.toast.textContent = message;
        this.elements.toast.style.opacity = '1';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.elements.toast.style.opacity = '0';
        }, 3500);
    }
}
