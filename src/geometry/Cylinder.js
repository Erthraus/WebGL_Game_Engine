/**
 * Cylinder Class
 * A procedural geometry class representing a 3D Cylinder.
 * Generates an open-ended cylinder (tube) by calculating vertex positions,
 * normals, and texture coordinates based on radius and height.
 */
export class Cylinder {
    /**
     * Creates a new Cylinder instance.
     * @param {WebGL2RenderingContext} gl - The WebGL rendering context.
     * @param {number} radius - The radius of the cylinder (default: 1.0).
     * @param {number} height - The height of the cylinder (default: 2.0).
     * @param {number} radialSegments - The number of segmented faces around the circumference (default: 32).
     */
    constructor(gl, radius, height, radialSegments) {
        this.gl = gl;
        this.radius = radius || 1.0;
        this.height = height || 2.0;
        this.radialSegments = radialSegments || 32;
        this.count = 0; 
        this.buffers = this.initBuffers();
    }

    /**
     * Initializes the WebGL buffers with geometry data.
     * Calculates vertices and normals procedurally.
     * @returns {Object} An object containing the WebGL buffers.
     */
    initBuffers() {
        const gl = this.gl;
        const positions = [];
        const normals = [];
        const textureCoords = [];
        const indices = [];

        const halfHeight = this.height / 2;

        // Generate vertices around the cylinder
        for (let i = 0; i <= this.radialSegments; i++) {
            const theta = i * 2 * Math.PI / this.radialSegments;
            const x = Math.cos(theta); // Unit circle X
            const z = Math.sin(theta); // Unit circle Z
            
            const u = i / this.radialSegments;

            // Top Vertex
            positions.push(x * this.radius, halfHeight, z * this.radius);
            normals.push(x, 0.0, z); // Normal points horizontally outwards
            textureCoords.push(u, 0.0);

            // Bottom Vertex
            positions.push(x * this.radius, -halfHeight, z * this.radius);
            normals.push(x, 0.0, z); // Normal points horizontally outwards
            textureCoords.push(u, 1.0);
        }

        // Generate indices for the side faces (two triangles per segment)
        for (let i = 0; i < this.radialSegments; i++) {
            const topCurrent = i * 2;
            const bottomCurrent = i * 2 + 1;
            const topNext = (i * 2 + 2);
            const bottomNext = (i * 2 + 3);
            
            // Triangle 1
            indices.push(topCurrent, bottomCurrent, topNext);
            // Triangle 2
            indices.push(bottomCurrent, bottomNext, topNext);
        }
        this.count = indices.length;

        // Create Position Buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        // Create Normal Buffer (NEW)
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
     * Draws the cylinder geometry.
     * @param {Object} programInfo - The shader program info containing attribute locations.
     */
    draw(programInfo) {
        const gl = this.gl;

        // Bind Position Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        // Bind Normal Buffer (NEW)
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