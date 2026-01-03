/**
 * ObjLoader Class
 * A static utility class responsible for loading and parsing Wavefront .obj files.
 * It converts raw text data into WebGL-compatible buffers (vertices, normals, texture coordinates, indices).
 */
export class ObjLoader {
    /**
     * Asynchronously loads an OBJ file from a given URL.
     * @param {WebGL2RenderingContext} gl - The WebGL context used to create buffers.
     * @param {string} url - The URL path to the .obj file.
     * @returns {Promise<Object>} A promise that resolves to the created mesh object (containing buffers and a draw method).
     */
    static async load(gl, url) {
        const response = await fetch(url);
        const text = await response.text();

        const objData = this.parse(text);
        return this.createMesh(gl, objData);
    }

    /**
     * Parses the raw text content of an OBJ file.
     * Processes vertices (v), texture coordinates (vt), normals (vn), and faces (f).
     * Handles triangulation for quads and flattens data for WebGL buffers.
     * * @param {string} text - The raw string content of the OBJ file.
     * @returns {Object} An object containing arrays for positions, texCoords, normals, and indices.
     */
    static parse(text) {
        // Raw data arrays from the file
        const positions = [];
        const texCoords = [];
        const normals = [];

        // Flattened (unrolled) data arrays prepared for WebGL buffers
        const finalPositions = [];
        const finalTexCoords = [];
        const finalNormals = [];
        const finalIndices = [];

        // Cache to track unique v/vt/vn combinations to generate efficient indices
        const indexCache = {}; 
        let indexCounter = 0;

        const lines = text.split('\n');

        for (let line of lines) {
            line = line.trim();
            // Skip comments and empty lines
            if (line.startsWith('#') || line === '') continue;

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Geometric vertices (x, y, z)
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vt') {
                // Texture coordinates (u, v)
                texCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
            } else if (type === 'vn') {
                // Vertex normals (x, y, z)
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'f') {
                // Faces: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
                const faceVertices = parts.slice(1);
                
                // Triangulation: If the face is a Quad (4 vertices), split it into 2 triangles
                // Loop ensures it handles polygons with more than 3 vertices
                for (let i = 0; i < faceVertices.length - 2; i++) {
                    const triangle = [faceVertices[0], faceVertices[i+1], faceVertices[i+2]];
                    
                    for (const vertString of triangle) {
                        // Check if this specific vertex combination (v/vt/vn) has been processed before
                        if (indexCache[vertString] !== undefined) {
                            // If yes, reuse the existing index
                            finalIndices.push(indexCache[vertString]);
                        } else {
                            // Split the "v/vt/vn" string
                            // Example: "1/1/1" or "1//1" (if texture coords are missing)
                            // OBJ indices start at 1, so we shift them to 0-based for JavaScript arrays
                            const indices = vertString.split('/').map(x => x ? parseInt(x) - 1 : -1);
                            
                            const vIndex = indices[0];
                            const vtIndex = indices[1];
                            const vnIndex = indices[2];

                            // Process Position
                            finalPositions.push(...positions[vIndex]);

                            // Process Texture Coordinates (If available)
                            if (vtIndex >= 0 && texCoords[vtIndex]) {
                                finalTexCoords.push(...texCoords[vtIndex]);
                            } else {
                                finalTexCoords.push(0.0, 0.0); // Default to (0,0) if missing
                            }

                            // Process Normals (If available)
                            if (vnIndex >= 0 && normals[vnIndex]) {
                                finalNormals.push(...normals[vnIndex]);
                            } else {
                                finalNormals.push(0.0, 1.0, 0.0); // Default to up vector if missing
                            }

                            // Cache this new index
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

    /**
     * Creates WebGL buffers and returns a renderable mesh object.
     * * @param {WebGL2RenderingContext} gl - The WebGL context.
     * @param {Object} data - The parsed OBJ data containing arrays.
     * @returns {Object} An object containing the buffers, vertex count, and a `draw` method.
     */
    static createMesh(gl, data) {
        // Create and bind Vertex Position Buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);

        // Create and bind Normal Buffer
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

        // Create and bind Texture Coordinate Buffer
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoords), gl.STATIC_DRAW);

        // Create and bind Index Buffer (Element Array Buffer)
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

        const count = data.indices.length;

        // Return a Mesh object that encapsulates buffers and the draw logic
        return {
            buffers: {
                position: positionBuffer,
                normal: normalBuffer,
                textureCoord: texCoordBuffer,
                indices: indexBuffer
            },
            count: count,
            /**
             * Draws the mesh using the provided shader program info.
             * @param {Object} programInfo - Object containing attribute locations.
             */
            draw: function(programInfo) {
                // Enable and bind Position Attribute
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
                gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

                // Enable and bind Normal Attribute
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
                gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

                // Enable and bind Texture Coordinate Attribute
                gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
                gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

                // Bind Index Buffer and Draw
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
                gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
            }
        };
    }
}