export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false });
        this.contextVersion = 'webgl2';

        if (!this.gl) {
            this.gl = this.canvas.getContext('webgl', { antialias: true, alpha: false })
                || this.canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
            this.contextVersion = 'webgl1';
        }

        if (!this.gl) {
            throw new Error('Browser tidak mendukung WebGL 1.0 maupun WebGL 2.0.');
        }

        this.capabilities = {
            webgl2: this.contextVersion === 'webgl2',
            instancing: this.contextVersion === 'webgl2' || !!this.gl.getExtension('ANGLE_instanced_arrays'),
            depthTexture: this.contextVersion === 'webgl2'
                || !!this.gl.getExtension('WEBGL_depth_texture'),
        };

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.gl.clearColor(0.03, 0.03, 0.08, 1.0);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
}
