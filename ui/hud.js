export class HudOverlay {
    constructor() {
        this.elements = {
            fps: document.getElementById('stat-fps'),
            rendered: document.getElementById('stat-rendered'),
            total: document.getElementById('stat-total'),
            culled: document.getElementById('stat-culled'),
            efficiency: document.getElementById('stat-eff'),
            cullFrustum: document.getElementById('stat-cF'),
            cullOcclusion: document.getElementById('stat-cO'),
            cullLod: document.getElementById('stat-cL'),
            toast: document.getElementById('toast'),
        };
        this._toastTimer = null;
    }

    updateStats({ fps = 0, drawn = 0, total = 0, stageStats = null } = {}) {
        const culled = Math.max(0, Number(total) - Number(drawn));
        const efficiency = total > 0 ? Math.round((culled / total) * 100) : 0;

        this._setText(this.elements.fps, Math.round(Number(fps) || 0).toString());
        this._setText(this.elements.rendered, Number(drawn || 0).toLocaleString());
        this._setText(this.elements.total, Number(total || 0).toLocaleString());
        this._setText(this.elements.culled, culled.toLocaleString());
        this._setText(this.elements.efficiency, `${efficiency}%`);

        this._setText(this.elements.cullFrustum, Number(stageStats?.frustumCulled || 0).toLocaleString());
        this._setText(this.elements.cullOcclusion, Number(stageStats?.occlusionCulled || 0).toLocaleString());
        this._setText(this.elements.cullLod, Number(stageStats?.lodCulled || 0).toLocaleString());
    }

    showToast(message, durationMs = 2200) {
        const toast = this.elements.toast;
        if (!toast) return;

        toast.textContent = String(message || '');
        toast.style.opacity = '1';
        toast.style.pointerEvents = 'none';
        toast.style.position = toast.style.position || 'fixed';
        toast.style.left = toast.style.left || '50%';
        toast.style.bottom = toast.style.bottom || '18px';
        toast.style.transform = toast.style.transform || 'translateX(-50%)';
        toast.style.padding = toast.style.padding || '10px 14px';
        toast.style.borderRadius = toast.style.borderRadius || '10px';
        toast.style.background = toast.style.background || 'rgba(4, 10, 24, 0.92)';
        toast.style.border = toast.style.border || '1px solid rgba(124, 242, 255, 0.28)';
        toast.style.color = toast.style.color || '#cbe2ef';
        toast.style.fontFamily = toast.style.fontFamily || "'Share Tech Mono', monospace";
        toast.style.fontSize = toast.style.fontSize || '12px';
        toast.style.transition = toast.style.transition || 'opacity 0.18s ease';
        toast.style.zIndex = toast.style.zIndex || '260';

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = '0';
        }, Math.max(400, Number(durationMs) || 2200));
    }

    _setText(element, value) {
        if (element) element.textContent = value;
    }
}

