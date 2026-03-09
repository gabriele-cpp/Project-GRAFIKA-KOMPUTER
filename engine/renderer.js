export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl     = this.canvas.getContext('webgl2');

        if (!this.gl) {
            alert('Browser tidak support WebGL2!');
            return;
        }

        // [BARU] Aktifkan depth testing (penting untuk scene 3D yang benar)
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.gl.clearColor(0.03, 0.03, 0.08, 1.0); // Warna background: biru gelap ruang angkasa
    }

    resize() {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
}
