export class Shader {
    constructor(gl, vertexSource, fragmentSource) {
        this.gl      = gl;
        this.program = this.createProgram(vertexSource, fragmentSource);
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const vs  = this.compileShader(this.gl.VERTEX_SHADER,   vertexSource);
        const fs  = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        const prg = this.gl.createProgram();
        this.gl.attachShader(prg, vs);
        this.gl.attachShader(prg, fs);
        this.gl.linkProgram(prg);
        if (!this.gl.getProgramParameter(prg, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(prg));
            return null;
        }
        return prg;
    }

    use() { this.gl.useProgram(this.program); }
}
