export class Sphere {
    constructor(gl, radius, latBands, longBands) {
        this.gl = gl;
        this.radius = radius || 1.0;
        this.latBands = latBands || 30;
        this.longBands = longBands || 30;
        this.buffers = this.initBuffers();
        this.count = this.latBands * this.longBands * 6; 
    }

    initBuffers() {
        const gl = this.gl;
        const positions = [];
        const normals = []; // YENİ
        const textureCoords = [];
        const indices = [];

        for (let latNumber = 0; latNumber <= this.latBands; latNumber++) {
            const theta = latNumber * Math.PI / this.latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let longNumber = 0; longNumber <= this.longBands; longNumber++) {
                const phi = longNumber * 2 * Math.PI / this.longBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                const u = 1 - (longNumber / this.longBands);
                const v = 1 - (latNumber / this.latBands);

                // Normal (Küre merkezinden dışa doğru birim vektör)
                normals.push(x, y, z);
                
                // Texture Coord
                textureCoords.push(u, v);

                // Position
                positions.push(this.radius * x);
                positions.push(this.radius * y);
                positions.push(this.radius * z);
            }
        }

        for (let latNumber = 0; latNumber < this.latBands; latNumber++) {
            for (let longNumber = 0; longNumber < this.longBands; longNumber++) {
                const first = (latNumber * (this.longBands + 1)) + longNumber;
                const second = first + this.longBands + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

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