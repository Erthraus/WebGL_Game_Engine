export class ShaderProgram {
    constructor(gl, vsSource, fsSource) {
        this.gl = gl;
        this.program = this.initShaderProgram(vsSource, fsSource);
        
        if (!this.program) {
            throw new Error("Shader programı başlatılamadı.");
        }
    }

    // Shader programını kullan
    use() {
        this.gl.useProgram(this.program);
    }

    // Attribute veya Uniform lokasyonlarını bulmak için yardımcı
    getAttribLocation(name) {
        return this.gl.getAttribLocation(this.program, name);
    }

    getUniformLocation(name) {
        return this.gl.getUniformLocation(this.program, name);
    }

    // Shader derleme işlemleri (Boilerplate kodlar)
    initShaderProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            console.error('Shader programı link edilemedi: ' + this.gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }

    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader derlenirken hata oluştu: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}