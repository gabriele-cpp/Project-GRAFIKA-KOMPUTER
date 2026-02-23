export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        // Kita pakai WebGL2 biar fitur grafisnya lebih modern
        this.gl = this.canvas.getContext('webgl2');

        if (!this.gl) {
            alert('Waduh, browsermu tidak support WebGL2!');
            return;
        }

        // Menyesuaikan ukuran kanvas dengan layar
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Set warna latar belakang (misal: abu-abu gelap)
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    // Fungsi ini akan dipanggil setiap frame (Loop)
    render() {
        // Bersihkan layar setiap frame sebelum menggambar yang baru
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Nanti kode untuk menggambar objek 3D taruh di sini
    }
}