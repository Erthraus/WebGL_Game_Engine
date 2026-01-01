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
let cube, sphere, cylinder, prism; 
let externalModel = null; 
let camera;     
let topCamera;  
let cubeTexture;
const keysPressed = {}; 
let projectionMatrix = mat4.create();

const spawnedObjects = [];

let gui;
const settings = {
    // Işık
    lightX: 5.0,
    lightY: 10.0,
    lightZ: 5.0,
    
    // Model
    modelScale: 0.5,
    rotationSpeed: 1.0,
    
    // Genel
    bgColor: [25, 25, 25],
    enableDualView: false, // YENİ: Varsayılan kapalı (Tek ekran)

    // Görünürlük (Hepsi false yapıldı - Ekran temiz başlasın)
    showCube: false,
    showSphere: false,
    showCylinder: false,
    showPrism: false,
    showCar: false,

    // Aksiyonlar
    spawnCube: function() { addRandomObject('cube'); },
    spawnSphere: function() { addRandomObject('sphere'); },
    clearScene: function() { spawnedObjects.length = 0; }
};

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

    window.addEventListener('keydown', (e) => { keysPressed[e.code] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.code] = false; });
    
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            camera.processMouseMovement(e.movementX, e.movementY);
        }
    });

    // --- GUI ---
    gui = new dat.GUI();
    
    // Ana Ayarlar
    const generalFolder = gui.addFolder('Genel Ayarlar');
    generalFolder.add(settings, 'enableDualView').name('Çift Kamera (Bonus)');
    generalFolder.addColor(settings, 'bgColor').name('Arkaplan');
    generalFolder.open();

    const spawnFolder = gui.addFolder('Obje Oluşturucu');
    spawnFolder.add(settings, 'spawnCube').name('+ Rastgele Küp');
    spawnFolder.add(settings, 'spawnSphere').name('+ Rastgele Küre');
    spawnFolder.add(settings, 'clearScene').name('Sahneyi Temizle');
    spawnFolder.open();

    const visFolder = gui.addFolder('Sabit Objeler (Gizli)');
    visFolder.add(settings, 'showCube').name('Küpü Göster');
    visFolder.add(settings, 'showSphere').name('Küreyi Göster');
    visFolder.add(settings, 'showCylinder').name('Silindiri Göster');
    visFolder.add(settings, 'showPrism').name('Prizmayı Göster');
    visFolder.add(settings, 'showCar').name('Arabayı Göster');
    
    const lightFolder = gui.addFolder('Işık Ayarları');
    lightFolder.add(settings, 'lightX', -20, 20);
    lightFolder.add(settings, 'lightY', -20, 20);
    lightFolder.add(settings, 'lightZ', -20, 20);

    const modelFolder = gui.addFolder('Araba Ayarları');
    modelFolder.add(settings, 'modelScale', 0.1, 3.0);
    modelFolder.add(settings, 'rotationSpeed', 0.0, 10.0);

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

    cube = new Cube(gl);
    sphere = new Sphere(gl, 0.8, 30, 30);      
    cylinder = new Cylinder(gl, 0.6, 1.5, 30); 
    prism = new Cylinder(gl, 0.7, 2.0, 6); 

    cubeTexture = loadTexture(gl, 'assets/box.jpg'); 

    camera = new Camera([0, 2, 10], [0, 1, 0], -90, 0);
    topCamera = new Camera([0, 20, 0], [0, 1, 0], -90, -90);

    ObjLoader.load(gl, 'assets/car.obj') 
        .then(mesh => { externalModel = mesh; })
        .catch(err => console.error(err));

    requestAnimationFrame(render);
}

function addRandomObject(type) {
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random()) * 5; 
    const z = (Math.random() - 0.5) * 20;
    
    spawnedObjects.push({
        type: type, 
        position: [x, y, z],
        rotationAxis: [Math.random(), Math.random(), Math.random()] 
    });
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

    const width = gl.canvas.width;
    const height = gl.canvas.height;
    
    // Arkaplan Rengi (GUI)
    const r = settings.bgColor[0] / 255;
    const g = settings.bgColor[1] / 255;
    const b = settings.bgColor[2] / 255;

    // --- YENİ: DUAL VIEWPORT MANTIĞI ---
    if (settings.enableDualView) {
        // --- ÇİFT EKRAN MODU (BONUS) ---
        gl.enable(gl.SCISSOR_TEST);
        const halfWidth = width / 2;

        // 1. SOL EKRAN (FPS)
        gl.viewport(0, 0, halfWidth, height);
        gl.scissor(0, 0, halfWidth, height);
        gl.clearColor(r, g, b, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));

        // 2. SAĞ EKRAN (Top-Down)
        gl.viewport(halfWidth, 0, halfWidth, height);
        gl.scissor(halfWidth, 0, halfWidth, height);
        gl.clearColor(0.1, 0.1, 0.2, 1.0); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        drawScene(now, topCamera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));
        
        gl.disable(gl.SCISSOR_TEST);

    } else {
        // --- TEK EKRAN MODU (NORMAL) ---
        // Scissor testini kapatmak önemli, yoksa ekranın yarısı çizilmez
        gl.disable(gl.SCISSOR_TEST); 
        
        gl.viewport(0, 0, width, height);
        gl.clearColor(r, g, b, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Sadece ana kamerayı çiz
        drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));
    }

    requestAnimationFrame(render);
}

function drawScene(now, activeCamera, projectionUpdateFn) {
    gl.useProgram(programInfo.program);
    
    // Aspect Ratio hesaplaması (Çift ekransa genişlik yarıya iner)
    // Bunu drawScene'e parametre olarak gelen projectionUpdateFn hallediyor
    const aspect = settings.enableDualView ? (gl.canvas.width / 2) / gl.canvas.height : gl.canvas.width / gl.canvas.height;
    projectionUpdateFn(aspect);

    const viewMatrix = activeCamera.getViewMatrix();
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3f(programInfo.uniformLocations.lightPosition, settings.lightX, settings.lightY, settings.lightZ);
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, activeCamera.position); 

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    const drawObject = (obj, position, rotationAxis, rotationSpeed = 1.0) => {
        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, position);
        if(rotationAxis) {
            mat4.rotate(modelMatrix, modelMatrix, now * rotationSpeed, rotationAxis);
        }
        let normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);
        obj.draw(programInfo);
    };

    // --- SABİT OBJELER (GUI'den açılır) ---
    if(settings.showCube) drawObject(cube, [-2.5, 0.0, 0.0], [0, 1, 0]);
    if(settings.showSphere) drawObject(sphere, [0.0, 0.0, 0.0], [1, 0, 0]);
    if(settings.showCylinder) drawObject(cylinder, [2.5, 0.0, 0.0], [1, 1, 0]);
    if(settings.showPrism) drawObject(prism, [-5.0, 0.0, 0.0], [0, 1, 0]);

    // --- SPAWNLANAN OBJELER ---
    spawnedObjects.forEach(obj => {
        if (obj.type === 'cube') {
            drawObject(cube, obj.position, obj.rotationAxis, 0.5); 
        } else if (obj.type === 'sphere') {
            drawObject(sphere, obj.position, obj.rotationAxis, 0.5);
        }
    });

    // --- ARABA MODELİ ---
    if (externalModel && settings.showCar) {
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
}

window.onload = main;