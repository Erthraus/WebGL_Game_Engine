import { ShaderProgram } from './core/ShaderProgram.js';
import { Camera } from './core/Camera.js'; 
import { Cube } from './geometry/Cube.js';
import { Sphere } from './geometry/Sphere.js';
import { Cylinder } from './geometry/Cylinder.js';
import { ObjLoader } from './core/ObjLoader.js';

const { mat4, mat3 } = glMatrix; 

// --- 1. PROJE DOSYALARI LİSTESİ (Manuel Tanımlama) ---
// Tarayıcı klasörü okuyamadığı için assets klasöründeki dosyaları buraya yazmalısınız.
const projectAssets = [
    // Hazır Şekiller (Procedural)
    { name: "Küp", type: "primitive", id: "cube", icon: "🧊" },
    { name: "Küre", type: "primitive", id: "sphere", icon: "⚪" },
    { name: "Silindir", type: "primitive", id: "cylinder", icon: "🛢️" },
    
    // Klasördeki OBJ Modelleri
    { name: "Araba", type: "model", file: "car.obj", icon: "🚗" },
    { name: "Çaydanlık", type: "model", file: "teapot.obj", icon: "🫖" }, 
    
    // Klasördeki Dokular (Textures)
    { name: "Kutu Doku", type: "texture", file: "box.jpg", icon: "📦" },
    // { name: "Duvar", type: "texture", file: "wall.jpg", icon: "🧱" }, // Örnek
];

// --- Global Değişkenler ---
let gl;
let programInfo;
let geometryTemplates = {}; 
let defaultTexture;

let camera;     
let topCamera;  
const keysPressed = {}; 
let projectionMatrix = mat4.create();

const objects = []; 
let selectedObjectIndex = -1; // Hiçbir şey seçili değil

let gui;
const guiState = {
    enableDualView: false,
    bgColor: [25, 25, 25],
    selectedName: "Yok",
    
    posX: 0, posY: 0, posZ: 0,
    scale: 1,
    rotX: 0, rotY: 0, rotZ: 0,
    
    lightX: 5, lightY: 10, lightZ: 5,

    deleteSelected: () => deleteSelectedObject(),
    importOBJ: () => document.getElementById('objInput').click(),
    importTexture: () => document.getElementById('textureInput').click(),
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

    setupFileInputs();
    
    // YENİ: Asset panelini oluştur
    generateAssetsPanel();

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

    // Geometri Şablonları
    geometryTemplates['cube'] = new Cube(gl);
    geometryTemplates['sphere'] = new Sphere(gl, 0.8, 30, 30);
    geometryTemplates['cylinder'] = new Cylinder(gl, 0.6, 1.5, 30);
    geometryTemplates['prism'] = new Cylinder(gl, 0.7, 2.0, 6);

    // Varsayılan texture (Box.jpg yoksa gri renk)
    defaultTexture = loadTexture(gl, 'assets/box.jpg');

    // --- SAHNE ARTIK BOŞ BAŞLIYOR ---
    // addObjectToScene(...) satırları silindi.

    camera = new Camera([0, 2, 10], [0, 1, 0], -90, 0);
    topCamera = new Camera([0, 20, 0], [0, 1, 0], -90, -90);

    initGUI(); 

    requestAnimationFrame(render);
}

// --- ASSETS PANEL OLUŞTURUCU (YENİ) ---
function generateAssetsPanel() {
    const container = document.getElementById('assetsContainer');
    container.innerHTML = ''; // Temizle

    // 1. Listeden kartları oluştur
    projectAssets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
            <div class="asset-icon">${asset.icon}</div>
            <div class="asset-label">${asset.name}</div>
        `;
        
        // Tıklama Olayları
        card.onclick = () => handleAssetClick(asset);
        
        container.appendChild(card);
    });

    // 2. Ayırıcı
    const divider = document.createElement('div');
    divider.style = "width:1px; height:50px; background:#444; margin:0 5px;";
    container.appendChild(divider);

    // 3. Sabit Import Araçları (Ekstra)
    const importTools = [
        { name: "Import OBJ", icon: "📂", action: () => document.getElementById('objInput').click() },
        { name: "Import IMG", icon: "🎨", action: () => document.getElementById('textureInput').click() },
        { name: "Temizle", icon: "🗑️", action: () => { if(confirm('Sil?')) { objects.length=0; updateGUIList(); } }, style: "border-color:#f44" }
    ];

    importTools.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        if(tool.style) card.style = tool.style;
        card.innerHTML = `<div class="asset-icon">${tool.icon}</div><div class="asset-label">${tool.name}</div>`;
        card.onclick = tool.action;
        container.appendChild(card);
    });
}

// Asset'e tıklanınca ne olacağını belirle
function handleAssetClick(asset) {
    if (asset.type === 'primitive') {
        // Küp, Küre vb. ekle
        spawnObject(asset.id);
    } 
    else if (asset.type === 'model') {
        // OBJ dosyasını assets klasöründen yükle
        // Not: Dosyanın gerçekten orada olması lazım
        ObjLoader.load(gl, 'assets/' + asset.file)
            .then(mesh => {
                const name = asset.name + " " + (objects.length + 1);
                const newObj = addObjectToScene(name, 'custom', [0, 2, 0]);
                newObj.model = mesh;
                newObj.scale = [0.5, 0.5, 0.5];
                selectLastObject();
            })
            .catch(err => alert("Model yüklenemedi: assets/" + asset.file + "\nDosya var mı?"));
    }
    else if (asset.type === 'texture') {
        // Doku dosyasını yükle ve SEÇİLİ objeye uygula
        if (selectedObjectIndex === -1 || !objects[selectedObjectIndex]) {
            alert("Önce bir obje seçmelisin!");
            return;
        }
        
        const texture = loadTexture(gl, 'assets/' + asset.file);
        objects[selectedObjectIndex].texture = texture;
    }
}

// --- NESNE YÖNETİMİ ---

function addObjectToScene(name, type, position) {
    const obj = {
        name: name,
        type: type, 
        position: position || [0, 0, 0],
        rotation: [0, 0, 0], 
        scale: [1, 1, 1],
        texture: defaultTexture,
        model: geometryTemplates[type] || null 
    };
    objects.push(obj);
    updateGUIList(); 
    return obj;
}

function spawnObject(type) {
    const x = (Math.random() - 0.5) * 5;
    const z = (Math.random() - 0.5) * 5;
    const name = type.charAt(0).toUpperCase() + type.slice(1) + " " + (objects.length + 1);
    addObjectToScene(name, type, [x, 0, z]);
    selectLastObject();
}

function selectLastObject() {
    selectedObjectIndex = objects.length - 1;
    syncGUItoObject();
}

function deleteSelectedObject() {
    if (selectedObjectIndex === -1) return;
    objects.splice(selectedObjectIndex, 1);
    selectedObjectIndex = -1;
    updateGUIList();
    syncGUItoObject();
}

// --- GUI MANTIĞI ---
let objListController;

function initGUI() {
    gui = new dat.GUI({ width: 300 });

    const mainFolder = gui.addFolder('Genel & Seçim');
    mainFolder.add(guiState, 'enableDualView').name('Çift Kamera');
    mainFolder.addColor(guiState, 'bgColor').name('Arkaplan');
    
    // Obje Listesi
    const objNames = {}; 
    objListController = mainFolder.add(guiState, 'selectedName', objNames).name('SEÇİLİ OBJE')
        .onChange((val) => {
            selectedObjectIndex = parseInt(val);
            syncGUItoObject(); 
        });

    mainFolder.add(guiState, 'deleteSelected').name('Seçiliyi SİL');
    mainFolder.open();

    const transformFolder = gui.addFolder('Transform');
    transformFolder.add(guiState, 'posX', -20, 20).onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posY', -10, 20).onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posZ', -20, 20).onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'scale', 0.1, 5.0).onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'rotY', 0, 360).onChange(updateObjectFromGUI);
    transformFolder.open();

    const lightFolder = gui.addFolder('Işık');
    lightFolder.add(guiState, 'lightX', -20, 20);
    lightFolder.add(guiState, 'lightY', -20, 20);
    lightFolder.add(guiState, 'lightZ', -20, 20);
}

function updateGUIList() {
    if (!objListController) return;
    const select = objListController.domElement.querySelector('select');
    select.innerHTML = '';
    
    // "Seçim Yok" seçeneği ekle
    const defaultOpt = document.createElement('option');
    defaultOpt.value = -1;
    defaultOpt.text = objects.length === 0 ? "(Sahne Boş)" : "(Obje Seçin)";
    select.add(defaultOpt);

    objects.forEach((o, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = o.name;
        select.add(opt);
    });
    objListController.setValue(selectedObjectIndex);
}

function syncGUItoObject() {
    if (selectedObjectIndex === -1 || !objects[selectedObjectIndex]) {
        guiState.selectedName = -1;
        return;
    }
    const obj = objects[selectedObjectIndex];
    guiState.posX = obj.position[0];
    guiState.posY = obj.position[1];
    guiState.posZ = obj.position[2];
    guiState.scale = obj.scale[0]; 
    guiState.rotY = obj.rotation[1];
    gui.updateDisplay();
}

function updateObjectFromGUI() {
    if (selectedObjectIndex === -1) return;
    const obj = objects[selectedObjectIndex];
    obj.position[0] = guiState.posX;
    obj.position[1] = guiState.posY;
    obj.position[2] = guiState.posZ;
    obj.scale = [guiState.scale, guiState.scale, guiState.scale];
    obj.rotation[1] = guiState.rotY;
}

// --- DOSYA YÜKLEME ---
function setupFileInputs() {
    document.getElementById('objInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = ObjLoader.parse(e.target.result);
            const mesh = ObjLoader.createMesh(gl, data);
            const name = "Model " + (objects.length + 1);
            const newObj = addObjectToScene(name, 'custom', [0, 2, 0]);
            newObj.model = mesh;
            selectLastObject();
        };
        reader.readAsText(file);
        this.value = '';
    });

    document.getElementById('textureInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const newTex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, newTex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.generateMipmap(gl.TEXTURE_2D);
                if (selectedObjectIndex !== -1) objects[selectedObjectIndex].texture = newTex;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        this.value = '';
    });
}

// --- RENDER ---
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Yüklenene kadar geçici gri renk
    const pixel = new Uint8Array([128, 128, 128, 255]); 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    // Dosya yoksa hata vermemesi için
    image.onerror = function() { console.warn("Texture bulunamadı: " + url); };
    image.src = url;
    return texture;
}

let then = 0;
function render(now) {
    now *= 0.001;
    const deltaTime = now - then;
    then = now;
    
    const speed = 5.0 * deltaTime; 
    if (keysPressed['KeyW']) camera.moveForward(speed);
    if (keysPressed['KeyS']) camera.moveForward(-speed);
    if (keysPressed['KeyA']) camera.moveRight(-speed);
    if (keysPressed['KeyD']) camera.moveRight(speed);
    if (keysPressed['KeyE']) camera.moveUp(speed);   
    if (keysPressed['KeyQ']) camera.moveUp(-speed);  

    const width = gl.canvas.width;
    const height = gl.canvas.height;
    const r = guiState.bgColor[0] / 255;
    const g = guiState.bgColor[1] / 255;
    const b = guiState.bgColor[2] / 255;

    if (guiState.enableDualView) {
        gl.enable(gl.SCISSOR_TEST);
        const halfWidth = width / 2;
        gl.viewport(0, 0, halfWidth, height);
        gl.scissor(0, 0, halfWidth, height);
        gl.clearColor(r, g, b, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));

        gl.viewport(halfWidth, 0, halfWidth, height);
        gl.scissor(halfWidth, 0, halfWidth, height);
        gl.clearColor(0.1, 0.1, 0.2, 1.0); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawScene(now, topCamera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));
        gl.disable(gl.SCISSOR_TEST);
    } else {
        gl.disable(gl.SCISSOR_TEST);
        gl.viewport(0, 0, width, height);
        gl.clearColor(r, g, b, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));
    }

    requestAnimationFrame(render);
}

function drawScene(now, activeCamera, projectionUpdateFn) {
    gl.useProgram(programInfo.program);
    const aspect = guiState.enableDualView ? (gl.canvas.width / 2) / gl.canvas.height : gl.canvas.width / gl.canvas.height;
    projectionUpdateFn(aspect);

    const viewMatrix = activeCamera.getViewMatrix();
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3f(programInfo.uniformLocations.lightPosition, guiState.lightX, guiState.lightY, guiState.lightZ);
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, activeCamera.position); 

    objects.forEach(obj => {
        if (!obj.model) return; 

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, obj.position);
        mat4.rotate(modelMatrix, modelMatrix, obj.rotation[1] * Math.PI / 180, [0, 1, 0]);
        mat4.scale(modelMatrix, modelMatrix, obj.scale);

        let normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);

        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        obj.model.draw(programInfo);
    });
}

function resizeCanvas() {
    const canvas = gl.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.onload = main;