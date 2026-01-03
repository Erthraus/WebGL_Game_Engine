/**
 * Sphere Class
 * A procedural geometry class representing a 3D Sphere (UV Sphere).
 * Generates vertices, normals, and texture coordinates by subdividing the sphere
 * into latitude and longitude bands.
 */
export class Sphere {
    /**
     * Creates a new Sphere instance.
     * @param {WebGL2RenderingContext} gl - The WebGL rendering context.
     * @param {number} radius - The radius of the sphere (default: 1.0).
     * @param {number} latBands - The number of horizontal segments (latitude bands) (default: 30).
     * @param {number} longBands - The number of vertical segments (longitude bands) (default: 30).
     */
    constructor(gl, radius, latBands, longBands) {
        this.gl = gl;
        this.radius = radius || 1.0;
        this.latBands = latBands || 30;
        this.longBands = longBands || 30;
        this.buffers = this.initBuffers();
        // Calculate total number of indices (2 triangles per square face * 3 vertices per triangle)
        this.count = this.latBands * this.longBands * 6; 
    }

    /**
     * Initializes the WebGL buffers with geometry data.
     * Calculates vertex positions using spherical coordinates.
     * @returns {Object} An object containing the WebGL buffers.
     */
    initBuffers() {
        const gl = this.gl;
        const positions = [];
        const normals = [];
        const textureCoords = [];
        const indices = [];

        // Generate vertices
        for (let latNumber = 0; latNumber <= this.latBands; latNumber++) {
            const theta = latNumber * Math.PI / this.latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let longNumber = 0; longNumber <= this.longBands; longNumber++) {
                const phi = longNumber * 2 * Math.PI / this.longBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // Convert spherical coordinates to Cartesian coordinates (Unit Sphere)
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                // Calculate UV coordinates
                const u = 1 - (longNumber / this.longBands);
                const v = 1 - (latNumber / this.latBands);

                // Normal (Unit vector pointing outward from the center)
                normals.push(x, y, z);
                
                // Texture Coordinates
                textureCoords.push(u, v);

                // Position (Scaled by radius)
                positions.push(this.radius * x);
                positions.push(this.radius * y);
                positions.push(this.radius * z);
            }
        }

        // Generate indices
        for (let latNumber = 0; latNumber < this.latBands; latNumber++) {
            for (let longNumber = 0; longNumber < this.longBands; longNumber++) {
                const first = (latNumber * (this.longBands + 1)) + longNumber;
                const second = first + this.longBands + 1;
                
                // First Triangle
                indices.push(first, second, first + 1);
                // Second Triangle
                indices.push(second, second + 1, first + 1);
            }
        }

        // Create Position Buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // Create Normal Buffer
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        // Create Texture Coordinate Buffer
        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

        // Create Index Buffer
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            normal: normalBuffer,
            textureCoord: textureCoordBuffer,
            indices: indexBuffer,
        };
    }

    /**
     * Draws the sphere geometry.
     * @param {Object} programInfo - The shader program info containing attribute locations.
     */
    draw(programInfo) {
        const gl = this.gl;

        // Bind Position Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        // Bind Normal Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

        // Bind Texture Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        // Bind Index Buffer and Draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}