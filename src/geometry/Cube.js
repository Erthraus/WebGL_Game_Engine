export class Cube {
    constructor(gl) {
        this.gl = gl;
        this.buffers = this.initBuffers();
        this.count = 36;
    }

    initBuffers() {
        const gl = this.gl;

        // 1. Positions
        const positions = [
            // Ön (Front)
            -1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0,  1.0,
            // Arka (Back)
            -1.0, -1.0, -1.0, -1.0,  1.0, -1.0,  1.0,  1.0, -1.0,  1.0, -1.0, -1.0,
            // Üst (Top)
            -1.0,  1.0, -1.0, -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0,
            // Alt (Bottom)
            -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
            // Sağ (Right)
             1.0, -1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0,
            // Sol (Left)
            -1.0, -1.0, -1.0, -1.0, -1.0,  1.0, -1.0,  1.0,  1.0, -1.0,  1.0, -1.0,
        ];

        // 2. Normals (YENİ: Yüzeyin baktığı yön)
        const normals = [
            // Ön (Z eksenine bakar: 0, 0, 1)
            0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,
            // Arka (Z tersine bakar: 0, 0, -1)
            0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,
            // Üst (Y eksenine bakar: 0, 1, 0)
            0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,
            // Alt (Y tersine bakar: 0, -1, 0)
            0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,
            // Sağ (X eksenine bakar: 1, 0, 0)
            1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,  1.0,  0.0,  0.0,
            // Sol (X tersine bakar: -1, 0, 0)
           -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0, -1.0,  0.0,  0.0,
        ];

        // 3. Texture Coordinates
        const textureCoords = [
            // Ön
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            // Arka
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            // Üst
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            // Alt
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            // Sağ
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            // Sol
            0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        ];

        // 4. Indices
        const indices = [
            0,  1,  2,      0,  2,  3,    
            4,  5,  6,      4,  6,  7,    
            8,  9,  10,     8,  10, 11,   
            12, 13, 14,     12, 14, 15,   
            16, 17, 18,     16, 18, 19,   
            20, 21, 22,     20, 22, 23,   
        ];

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
            normal: normalBuffer, // YENİ
            textureCoord: textureCoordBuffer,
            indices: indexBuffer,
        };
    }

    draw(programInfo) {
        const gl = this.gl;

        // Position
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        // Normal (YENİ)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

        // Texture
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        // Indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}