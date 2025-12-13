import { ShaderProgram } from './core/ShaderProgram.js';
import { Camera } from './core/Camera.js'; 
import { Cube } from './geometry/Cube.js';
import { Sphere } from './geometry/Sphere.js';
import { Cylinder } from './geometry/Cylinder.js';

const { mat4, mat3 } = glMatrix; // mat3 eklendi

// Global değişkenler
let gl;
let programInfo;
let cube, sphere, cylinder;
let camera; 
let cubeTexture;
const keysPressed = {}; 
let projectionMatrix = mat4.create();

// --- 1. Vertex Shader (Phong Lighting için hazırlandı) ---
const vsSource = `#version 300 es
    in vec4 aVertexPosition;
    in vec3 aVertexNormal;  // YENİ: Normal vektörü
    in vec2 aTextureCoord;

    uniform mat4 uModelMatrix;      // Modelin dünya üzerindeki yeri
    uniform mat4 uViewMatrix;       // Kamera
    uniform mat4 uProjectionMatrix; // Perspektif
    uniform mat3 uNormalMatrix;     // Normalleri düzgün döndürmek için

    out vec2 vTextureCoord;
    out vec3 vNormal;   // Fragment shader'a gidecek
    out vec3 vFragPos;  // Fragment shader'a gidecek (Dünya pozisyonu)

    void main(void) {
        // Pozisyonu Dünya Koordinatlarına çevir
        vec4 worldPosition = uModelMatrix * aVertexPosition;
        vFragPos = vec3(worldPosition);

        // Normalleri transform et (Boyut değişiminden etkilenmemesi için Normal Matrisi kullanılır)
        vNormal = uNormalMatrix * aVertexNormal;

        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
        vTextureCoord = aTextureCoord;
    }
`;

// --- 2. Fragment Shader (Phong Hesabı) ---
const fsSource = `#version 300 es
    precision highp float;

    in vec2 vTextureCoord;
    in vec3 vNormal;
    in vec3 vFragPos;

    uniform sampler2D uSampler;
    uniform vec3 uLightPosition; // Işığın yeri
    uniform vec3 uViewPosition;  // Kameranın yeri (Parlama hesabı için)

    out vec4 fragColor;

    void main(void) {
        // Texture rengini al
        vec4 texColor = texture(uSampler, vTextureCoord);

        // 1. Ambient (Ortam Işığı - Hafif aydınlık)
        float ambientStrength = 0.1;
        vec3 ambient = ambientStrength * vec3(1.0, 1.0, 1.0);

        // 2. Diffuse (Yaygın Işık - Yüzeyin ışığa bakma açısı)
        vec3 norm = normalize(vNormal);
        vec3 lightDir = normalize(uLightPosition - vFragPos);
        float diff = max(dot(norm, lightDir), 0.0);
        vec3 diffuse = diff * vec3(1.0, 1.0, 1.0); // Beyaz ışık

        // 3. Specular (Parlama - Kameraya yansıma)
        float specularStrength = 0.5;
        vec3 viewDir = normalize(uViewPosition - vFragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        // 32.0 değeri "shininess" (parlaklık keskinliği)
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        vec3 specular = specularStrength * spec * vec3(1.0, 1.0, 1.0);

        // Sonuçları birleştir: (Ambient + Diffuse + Specular) * TextureRengi
        vec3 result = (ambient + diffuse + specular) * vec3(texColor);
        
        fragColor = vec4(result, texColor.a);
    }
`;

function main() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl2');
    if (!gl) { alert('WebGL2 yok!'); return; }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Klavye & Mouse
    window.addEventListener('keydown', (e) => { keysPressed[e.code] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.code] = false; });
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            camera.processMouseMovement(e.movementX, e.movementY);
        }
    });

    const shader = new ShaderProgram(gl, vsSource, fsSource);
    
    // --- Program Info GÜNCELLENDİ ---
    programInfo = {
        program: shader.program,
        attribLocations: {
            vertexPosition: shader.getAttribLocation('aVertexPosition'),
            vertexNormal: shader.getAttribLocation('aVertexNormal'), // YENİ
            textureCoord: shader.getAttribLocation('aTextureCoord'),
        },
        uniformLocations: {
            projectionMatrix: shader.getUniformLocation('uProjectionMatrix'),
            viewMatrix: shader.getUniformLocation('uViewMatrix'),   // ModelView ayrıldı
            modelMatrix: shader.getUniformLocation('uModelMatrix'), // ModelView ayrıldı
            normalMatrix: shader.getUniformLocation('uNormalMatrix'), // YENİ
            uSampler: shader.getUniformLocation('uSampler'),
            
            // Işık değişkenleri
            lightPosition: shader.getUniformLocation('uLightPosition'),
            viewPosition: shader.getUniformLocation('uViewPosition'),
        },
    };

    cube = new Cube(gl);
    sphere = new Sphere(gl, 0.8, 30, 30);      
    cylinder = new Cylinder(gl, 0.6, 1.5, 30); 
    camera = new Camera([0, 2, 10], [0, 1, 0], -90, 0);
    cubeTexture = loadTexture(gl, 'assets/box.jpg');

    requestAnimationFrame(render);
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const pixel = new Uint8Array([0, 0, 255, 255]); 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;
    return texture;
}

function processInput(deltaTime) {
    const speed = 5.0 * deltaTime; 
    if (keysPressed['KeyW']) camera.moveForward(speed);
    if (keysPressed['KeyS']) camera.moveForward(-speed);
    if (keysPressed['KeyA']) camera.moveRight(-speed);
    if (keysPressed['KeyD']) camera.moveRight(speed);
    if (keysPressed['KeyE']) camera.moveUp(speed);   
    if (keysPressed['KeyQ']) camera.moveUp(-speed);  
}

let then = 0;

function render(now) {
    now *= 0.001;
    const deltaTime = now - then;
    then = now;
    processInput(deltaTime);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    // 1. Matrisleri Hazırla
    const fieldOfView = 45 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, 100.0);
    
    const viewMatrix = camera.getViewMatrix(); 

    // Uniformları Gönder (Projection ve View)
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Işık Pozisyonu (Kameranın sağ üstünde bir yerde duralım)
    gl.uniform3f(programInfo.uniformLocations.lightPosition, 5.0, 5.0, 5.0);
    // Kamera Pozisyonu (Parlama hesabı için gerekli)
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, camera.position);

    // Texture Bağla
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    // --- Çizim Yardımcı Fonksiyonu ---
    const drawObject = (obj, position, rotationAxis) => {
        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, position);
        if(rotationAxis) {
            mat4.rotate(modelMatrix, modelMatrix, now, rotationAxis);
        }

        // Normal Matrisini Hesapla (Model Matrisinin tersinin transpozu)
        let normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);

        // Uniformları Gönder
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        obj.draw(programInfo);
    };

    // Küp, Küre ve Silindiri Çiz
    drawObject(cube, [-2.5, 0.0, 0.0], [0, 1, 0]);
    drawObject(sphere, [0.0, 0.0, 0.0], [1, 0, 0]);
    drawObject(cylinder, [2.5, 0.0, 0.0], [1, 1, 0]);

    requestAnimationFrame(render);
}

function resizeCanvas() {
    const canvas = gl.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.onload = main;