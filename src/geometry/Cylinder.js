export class Cylinder {
    constructor(gl, radius, height, radialSegments) {
        this.gl = gl;
        this.radius = radius || 1.0;
        this.height = height || 2.0;
        this.radialSegments = radialSegments || 32;
        this.count = 0; 
        this.buffers = this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;
        const positions = [];
        const normals = []; // YENİ
        const textureCoords = [];
        const indices = [];

        const halfHeight = this.height / 2;

        for (let i = 0; i <= this.radialSegments; i++) {
            const theta = i * 2 * Math.PI / this.radialSegments;
            const x = Math.cos(theta); // Birim çember
            const z = Math.sin(theta);
            
            const u = i / this.radialSegments;

            // Üst Vertex
            positions.push(x * this.radius, halfHeight, z * this.radius);
            normals.push(x, 0.0, z); // Normal yataydır
            textureCoords.push(u, 0.0);

            // Alt Vertex
            positions.push(x * this.radius, -halfHeight, z * this.radius);
            normals.push(x, 0.0, z); // Normal yataydır
            textureCoords.push(u, 1.0);
        }

        for (let i = 0; i < this.radialSegments; i++) {
            const topCurrent = i * 2;
            const bottomCurrent = i * 2 + 1;
            const topNext = (i * 2 + 2);
            const bottomNext = (i * 2 + 3);
            indices.push(topCurrent, bottomCurrent, topNext);
            indices.push(bottomCurrent, bottomNext, topNext);
        }
        this.count = indices.length;

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const normalBuffer = gl.createBuffer(); // YENİ
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

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

    draw(programInfo) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal); // YENİ
        gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}