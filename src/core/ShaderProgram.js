/**
 * ShaderProgram Class
 * A utility class to handle the compilation, linking, and management of WebGL shader programs.
 * It encapsulates the boilerplate code required to load vertex and fragment shaders.
 */
export class ShaderProgram {
    /**
     * Creates and initializes a shader program.
     * @param {WebGL2RenderingContext} gl - The WebGL rendering context.
     * @param {string} vsSource - The source code for the vertex shader.
     * @param {string} fsSource - The source code for the fragment shader.
     */
    constructor(gl, vsSource, fsSource) {
        this.gl = gl;
        this.program = this.initShaderProgram(vsSource, fsSource);
        
        if (!this.program) {
            throw new Error("Unable to initialize the shader program.");
        }
    }

    /**
     * Binds this shader program to the WebGL context for use.
     * Must be called before drawing anything using this program.
     */
    use() {
        this.gl.useProgram(this.program);
    }

    /**
     * Retrieves the location of an attribute variable in the shader program.
     * @param {string} name - The name of the attribute variable in the GLSL code.
     * @returns {GLint} The location of the attribute.
     */
    getAttribLocation(name) {
        return this.gl.getAttribLocation(this.program, name);
    }

    /**
     * Retrieves the location of a uniform variable in the shader program.
     * @param {string} name - The name of the uniform variable in the GLSL code.
     * @returns {WebGLUniformLocation} The location of the uniform.
     */
    getUniformLocation(name) {
        return this.gl.getUniformLocation(this.program, name);
    }

    /**
     * Initializes the shader program by creating, compiling, and linking shaders.
     * This handles the standard WebGL boilerplate for shader setup.
     * @param {string} vsSource - Vertex shader source code.
     * @param {string} fsSource - Fragment shader source code.
     * @returns {WebGLProgram|null} The linked WebGL program object, or null if initialization failed.
     */
    initShaderProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        // Check for linking errors
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }

    /**
     * Creates a shader of the given type, uploads the source and compiles it.
     * @param {GLenum} type - The type of shader (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER).
     * @param {string} source - The GLSL source code.
     * @returns {WebGLShader|null} The compiled shader, or null if compilation failed.
     */
    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        // Check for compilation errors
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}