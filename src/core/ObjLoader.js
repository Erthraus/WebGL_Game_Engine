export class ObjLoader {
    static async load(gl, url) {
        const response = await fetch(url);
        const text = await response.text();

        const objData = this.parse(text);
        return this.createMesh(gl, objData);
    }

    static parse(text) {
        const positions = [];
        const texCoords = [];
        const normals = [];

        // WebGL için düzleştirilmiş (unrolled) veriler
        const finalPositions = [];
        const finalTexCoords = [];
        const finalNormals = [];
        const finalIndices = [];

        // v/vt/vn kombinasyonlarını takip etmek için cache
        const indexCache = {}; 
        let indexCounter = 0;

        const lines = text.split('\n');

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('#') || line === '') continue;

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vt') {
                texCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
            } else if (type === 'vn') {
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'f') {
                // Yüzeyler: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
                const faceVertices = parts.slice(1);
                
                // Üçgenleme (Triangulation): Eğer 4 köşeli (Quad) ise 2 üçgene böl
                for (let i = 0; i < faceVertices.length - 2; i++) {
                    const triangle = [faceVertices[0], faceVertices[i+1], faceVertices[i+2]];
                    
                    for (const vertString of triangle) {
                        // "v/vt/vn" stringini parçala
                        // Örnek: "1/1/1" veya "1//1"
                        if (indexCache[vertString] !== undefined) {
                            finalIndices.push(indexCache[vertString]);
                        } else {
                            const indices = vertString.split('/').map(x => x ? parseInt(x) - 1 : -1); // OBJ indeksleri 1'den başlar, 0'a çekiyoruz
                            
                            const vIndex = indices[0];
                            const vtIndex = indices[1];
                            const vnIndex = indices[2];

                            // Pozisyon
                            finalPositions.push(...positions[vIndex]);

                            // Texture (Varsa)
                            if (vtIndex >= 0 && texCoords[vtIndex]) {
                                finalTexCoords.push(...texCoords[vtIndex]);
                            } else {
                                finalTexCoords.push(0.0, 0.0); // Yoksa varsayılan
                            }

                            // Normal (Varsa)
                            if (vnIndex >= 0 && normals[vnIndex]) {
                                finalNormals.push(...normals[vnIndex]);
                            } else {
                                finalNormals.push(0.0, 1.0, 0.0); // Yoksa yukarı bak
                            }

                            indexCache[vertString] = indexCounter;
                            finalIndices.push(indexCounter);
                            indexCounter++;
                        }
                    }
                }
            }
        }

        return {
            positions: finalPositions,
            texCoords: finalTexCoords,
            normals: finalNormals,
            indices: finalIndices
        };
    }

    static createMesh(gl, data) {
        // Vertex Buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);

        // Normal Buffer
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

        // Texture Buffer
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoords), gl.STATIC_DRAW);

        // Index Buffer
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

        const count = data.indices.length;

        // Draw fonksiyonunu içeren bir nesne döndür
        return {
            buffers: {
                position: positionBuffer,
                normal: normalBuffer,
                textureCoord: texCoordBuffer,
                indices: indexBuffer
            },
            count: count,
            draw: function(programInfo) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
                gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
                gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
                gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
                gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
            }
        };
    }
}