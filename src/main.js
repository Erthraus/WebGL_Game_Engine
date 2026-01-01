import { ShaderProgram } from './core/ShaderProgram.js';
import { Camera } from './core/Camera.js'; 
import { Cube } from './geometry/Cube.js';
import { Sphere } from './geometry/Sphere.js';
import { Cylinder } from './geometry/Cylinder.js';
import { ObjLoader } from './core/ObjLoader.js';

const { mat4, mat3 } = glMatrix; 

// --- Global Değişkenler ---
let gl;
let programInfo;
let cube, sphere, cylinder, prism; // YENİ: Prism eklendi
let externalModel = null; 
let camera;     // Ana Kamera (FPS)
let topCamera;  // YENİ: Kuş Bakışı Kamera (Bonus)
let cubeTexture;
const keysPressed = {}; 
let projectionMatrix = mat4.create();

// GUI Değişkeni ve Ayarlar
let gui;
const settings = {
    // Işık (Light) Ayarları
    lightX: 5.0,
    lightY: 10.0,
    lightZ: 5.0,
    
    // Model Ayarları
    modelScale: 0.5,
    rotationSpeed: 1.0,
    
    // Arkaplan Rengi
    bgColor: [25, 25, 25] 
};

// --- Shader Kodları ---
const vsSource = `#version 300 es
    in vec4 aVertexPosition;
    in vec3 aVertexNormal; 
    in vec2 aTextureCoord;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat3 uNormalMatrix;
    out vec2 vTextureCoord;
    out vec3 vNormal;
    out vec3 vFragPos;
    void main(void) {
        vec4 worldPosition = uModelMatrix * aVertexPosition;
        vFragPos = vec3(worldPosition);
        vNormal = uNormalMatrix * aVertexNormal;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
        vTextureCoord = aTextureCoord;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    in vec3 vNormal;
    in vec3 vFragPos;
    uniform sampler2D uSampler;
    uniform vec3 uLightPosition;
    uniform vec3 uViewPosition;
    out vec4 fragColor;
    void main(void) {
        vec4 texColor = texture(uSampler, vTextureCoord);
        
        float ambientStrength = 0.1;
        vec3 ambient = ambientStrength * vec3(1.0, 1.0, 1.0);
        
        vec3 norm = normalize(vNormal);
        vec3 lightDir = normalize(uLightPosition - vFragPos);
        float diff = max(dot(norm, lightDir), 0.0);
        vec3 diffuse = diff * vec3(1.0, 1.0, 1.0);
        
        float specularStrength = 0.5;
        vec3 viewDir = normalize(uViewPosition - vFragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        vec3 specular = specularStrength * spec * vec3(1.0, 1.0, 1.0);
        
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

    // Girdiler
    window.addEventListener('keydown', (e) => { keysPressed[e.code] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.code] = false; });
    
    // Mouse kilitleme sadece sol tarafta mantıklı olur ama şimdilik tüm canvasa verelim
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            camera.processMouseMovement(e.movementX, e.movementY);
        }
    });

    // GUI Panelini Oluştur
    gui = new dat.GUI();
    const lightFolder = gui.addFolder('Işık Pozisyonu');
    lightFolder.add(settings, 'lightX', -20, 20);
    lightFolder.add(settings, 'lightY', -20, 20);
    lightFolder.add(settings, 'lightZ', -20, 20);
    lightFolder.open();

    const modelFolder = gui.addFolder('Model Ayarları');
    modelFolder.add(settings, 'modelScale', 0.1, 3.0);
    modelFolder.add(settings, 'rotationSpeed', 0.0, 10.0);
    modelFolder.open();

    gui.addColor(settings, 'bgColor').name('Arkaplan');

    // Shader Başlatma
    const shader = new ShaderProgram(gl, vsSource, fsSource);
    
    programInfo = {
        program: shader.program,
        attribLocations: {
            vertexPosition: shader.getAttribLocation('aVertexPosition'),
            vertexNormal: shader.getAttribLocation('aVertexNormal'),
            textureCoord: shader.getAttribLocation('aTextureCoord'),
        },
        uniformLocations: {
            projectionMatrix: shader.getUniformLocation('uProjectionMatrix'),
            viewMatrix: shader.getUniformLocation('uViewMatrix'),   
            modelMatrix: shader.getUniformLocation('uModelMatrix'), 
            normalMatrix: shader.getUniformLocation('uNormalMatrix'), 
            uSampler: shader.getUniformLocation('uSampler'),
            lightPosition: shader.getUniformLocation('uLightPosition'),
            viewPosition: shader.getUniformLocation('uViewPosition'),
        },
    };

    // --- NESNELER ---
    cube = new Cube(gl);
    sphere = new Sphere(gl, 0.8, 30, 30);      
    cylinder = new Cylinder(gl, 0.6, 1.5, 30); 
    
    // YENİ: Prizma Oluşturma (Silindir sınıfını kullanarak)
    // 6 segment = Altıgen Prizma
    prism = new Cylinder(gl, 0.7, 2.0, 6); 

    cubeTexture = loadTexture(gl, 'assets/box.jpg'); 

    // --- KAMERALAR ---
    // 1. Ana Kamera (Oyuncu)
    camera = new Camera([0, 2, 10], [0, 1, 0], -90, 0);

    // 2. YENİ: Kuş Bakışı Kamera (Top-Down)
    // Çok yukarıda (Y=20) ve aşağı bakıyor (Pitch=-90)
    topCamera = new Camera([0, 20, 0], [0, 1, 0], -90, -90);

    // OBJ Yükleme
    ObjLoader.load(gl, 'assets/car.obj') 
        .then(mesh => { externalModel = mesh; })
        .catch(err => console.error(err));

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

    // YENİ: Scissor Test'i aç (Ekranı kesmek için gerekli)
    gl.enable(gl.SCISSOR_TEST);

    // Ekran Boyutları
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    const halfWidth = width / 2;

    // ------------------------------------------------
    // 1. SOL EKRAN (Ana Kamera - Gezilebilir)
    // ------------------------------------------------
    
    // Viewport: Çizimin yapılacağı alan (x, y, w, h)
    gl.viewport(0, 0, halfWidth, height);
    // Scissor: Temizlenecek (Clear) alan
    gl.scissor(0, 0, halfWidth, height);
    
    // Arkaplan rengi (GUI'den)
    const r = settings.bgColor[0] / 255;
    const g = settings.bgColor[1] / 255;
    const b = settings.bgColor[2] / 255;
    gl.clearColor(r, g, b, 1.0);
    
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sahneyi Çiz (Ana Kamera ile)
    drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));


    // ------------------------------------------------
    // 2. SAĞ EKRAN (Kuş Bakışı - Sabit)
    // ------------------------------------------------
    
    gl.viewport(halfWidth, 0, halfWidth, height);
    gl.scissor(halfWidth, 0, halfWidth, height);
    
    // Sağ tarafın arkaplanı biraz farklı olsun ki ayrım belli olsun
    gl.clearColor(0.1, 0.1, 0.2, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sahneyi Çiz (Tepe Kamera ile)
    // Buranın Aspect Ratio'su da halfWidth/height olmalı
    drawScene(now, topCamera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));

    // Scissor'ı kapat (Performans için)
    gl.disable(gl.SCISSOR_TEST);

    requestAnimationFrame(render);
}

// YENİ: Sahne Çizim Yardımcı Fonksiyonu
// Kod tekrarını önlemek için sahneyi buraya aldık. Hem sol hem sağ ekran burayı çağırır.
function drawScene(now, activeCamera, projectionUpdateFn) {
    gl.useProgram(programInfo.program);

    // Aspect Ratio güncelle (Yarım ekrana göre)
    const aspect = (gl.canvas.width / 2) / gl.canvas.height;
    projectionUpdateFn(aspect);

    // View Matrix (Hangi kamera aktifse onu kullan)
    const viewMatrix = activeCamera.getViewMatrix();

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Işık ve Kamera Pozisyonu
    gl.uniform3f(programInfo.uniformLocations.lightPosition, settings.lightX, settings.lightY, settings.lightZ);
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, activeCamera.position); // Parlama efekti için aktif kamerayı kullan

    // Texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    // --- NESNELERİ ÇİZ ---
    const drawObject = (obj, position, rotationAxis) => {
        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, position);
        if(rotationAxis) {
            mat4.rotate(modelMatrix, modelMatrix, now, rotationAxis);
        }
        let normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);

        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        obj.draw(programInfo);
    };

    drawObject(cube, [-2.5, 0.0, 0.0], [0, 1, 0]);
    drawObject(sphere, [0.0, 0.0, 0.0], [1, 0, 0]);
    drawObject(cylinder, [2.5, 0.0, 0.0], [1, 1, 0]);
    
    // YENİ: Prizmayı çiz (En sola koyalım)
    drawObject(prism, [-5.0, 0.0, 0.0], [0, 1, 0]);

    // Araba Modeli
    if (externalModel) {
        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [0.0, 0.0, -2.0]); 
        mat4.rotate(modelMatrix, modelMatrix, now * settings.rotationSpeed, [0, 1, 0]); 
        mat4.scale(modelMatrix, modelMatrix, [settings.modelScale, settings.modelScale, settings.modelScale]); 

        let normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);

        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        externalModel.draw(programInfo);
    }
}

function resizeCanvas() {
    const canvas = gl.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Viewport güncellemeleri render döngüsünde yapılıyor
}

window.onload = main;