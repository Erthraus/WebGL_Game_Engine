import { ShaderProgram } from './core/ShaderProgram.js';
import { Camera } from './core/Camera.js'; 
import { Cube } from './geometry/Cube.js';
import { Sphere } from './geometry/Sphere.js';
import { Cylinder } from './geometry/Cylinder.js';
import { ObjLoader } from './core/ObjLoader.js';

const { mat4, mat3 } = glMatrix; 

// --- 1. PROJE DOSYALARI LİSTESİ ---
const projectAssets = [
    { name: "Küp", type: "primitive", id: "cube", icon: "🧊" },
    { name: "Küre", type: "primitive", id: "sphere", icon: "⚪" },
    { name: "Silindir", type: "primitive", id: "cylinder", icon: "🛢️" },
    { name: "Prizma", type: "primitive", id: "prism", icon: "🔶" },
    { name: "Araba", type: "model", file: "car.obj", icon: "🚗" },
    { name: "Kutu Doku", type: "texture", file: "box.jpg", icon: "📦" },
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
let selectedObjectIndex = -1; 

// YENİ: IŞIK SİSTEMİ (3 Adet Işık)
// DÜZELTME: 'active' -> 'isActive' olarak değiştirildi
const lights = [
    { name: "Ana Işık (Güneş)", type: 1, pos: [5, 10, 5], color: [255, 255, 255], intensity: 1.0, isActive: true },
    { name: "Sol Lamba (Kırmızı)", type: 0, pos: [-5, 2, 0], color: [255, 50, 50], intensity: 2.0, isActive: true },
    { name: "Sağ Lamba (Mavi)", type: 0, pos: [5, 2, 0], color: [50, 50, 255], intensity: 2.0, isActive: true }
];
let selectedLightIndex = 0;

let gui;
const guiState = {
    enableDualView: false,
    bgColor: [25, 25, 25],
    selectedName: "Yok",
    
    // Transform (X, Y, Z Rotasyonları eklendi)
    posX: 0, posY: 0, posZ: 0,
    scale: 1,
    rotX: 0, rotY: 0, rotZ: 0,
    
    // Materyal
    shininess: 32.0,
    opacity: 1.0,         
    autoRotate: false,    
    
    // Sis
    fogDensity: 0.02,     
    fogColor: [25, 25, 25], 
    
    // Işık Yönetimi (Seçili ışığın ayarları)
    selLightName: "Ana Işık",
    lType: 1,
    lPosX: 5, lPosY: 10, lPosZ: 5,
    lColor: [255, 255, 255],
    lIntensity: 1.0,
    lActive: true, // GUI değişkeni ismi kalabilir, ama arkada isActive'i kontrol edecek
    
    // Bilgi
    currentTextureName: "Varsayılan",

    deleteSelected: () => deleteSelectedObject(),
    importOBJ: () => document.getElementById('objInput').click(),
    importTexture: () => document.getElementById('textureInput').click(),
};

// --- SHADER GÜNCELLEMESİ (ÇOKLU IŞIK DÖNGÜSÜ) ---
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
    out float vDist;
    
    void main(void) {
        vec4 worldPosition = uModelMatrix * aVertexPosition;
        vec4 viewPosition = uViewMatrix * worldPosition;
        
        vFragPos = vec3(worldPosition);
        vNormal = uNormalMatrix * aVertexNormal;
        vDist = length(viewPosition.xyz);
        
        gl_Position = uProjectionMatrix * viewPosition;
        vTextureCoord = aTextureCoord;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    
    in vec2 vTextureCoord;
    in vec3 vNormal;
    in vec3 vFragPos;
    in float vDist;
    
    uniform sampler2D uSampler;
    uniform vec3 uViewPosition;
    
    uniform float uShininess;
    uniform float uOpacity;       
    uniform bool uIsLightSource; // Işık kaynağını çiziyorsak düz renk
    uniform vec3 uSourceColor;   // Işık kaynağının kendi rengi
    
    // --- ÇOKLU IŞIK YAPISI ---
    struct Light {
        vec3 position;
        int type;       // 0: Point, 1: Directional
        vec3 color;
        float intensity;
        bool isActive;  // DÜZELTME: 'active' kelimesi 'isActive' yapıldı
    };
    
    #define MAX_LIGHTS 3
    uniform Light uLights[MAX_LIGHTS];
    
    // Sis
    uniform vec3 uFogColor;       
    uniform float uFogDensity;    
    
    out vec4 fragColor;
    
    vec3 calcLight(Light light, vec3 normal, vec3 viewDir, vec3 albedo) {
        if(!light.isActive) return vec3(0.0); // DÜZELTME

        vec3 lightDir;
        float attenuation = 1.0;

        if(light.type == 1) { // Directional
            lightDir = normalize(light.position);
        } else { // Point
            vec3 lightVec = light.position - vFragPos;
            float distance = length(lightVec);
            lightDir = normalize(lightVec);
            attenuation = 1.0 / (1.0 + 0.05 * distance * distance); // Inverse square law approximation
        }

        // Diffuse
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * light.color;

        // Specular
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
        vec3 specular = spec * light.color;

        return (diffuse + specular) * light.intensity * attenuation;
    }

    void main(void) {
        if(uIsLightSource) {
            fragColor = vec4(uSourceColor, 1.0);
            return;
        }

        vec4 texColor = texture(uSampler, vTextureCoord);
        vec3 norm = normalize(vNormal);
        vec3 viewDir = normalize(uViewPosition - vFragPos);
        
        // Ambient (Ortam Işığı - Sabit)
        vec3 ambient = 0.1 * vec3(1.0, 1.0, 1.0);
        
        // Tüm ışıkları topla
        vec3 totalLighting = vec3(0.0);
        for(int i = 0; i < MAX_LIGHTS; i++) {
            totalLighting += calcLight(uLights[i], norm, viewDir, texColor.rgb);
        }
        
        vec3 result = (ambient + totalLighting) * texColor.rgb;
        
        // Sis Efekti
        float fogFactor = 1.0 / exp(pow(vDist * uFogDensity, 2.0));
        fogFactor = clamp(fogFactor, 0.0, 1.0);
        vec3 finalColor = mix(uFogColor, result, fogFactor);
        
        fragColor = vec4(finalColor, uOpacity * texColor.a);
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
    generateAssetsPanel();

    const shader = new ShaderProgram(gl, vsSource, fsSource);
    
    // Uniform Locations
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
            viewPosition: shader.getUniformLocation('uViewPosition'),
            
            uShininess: shader.getUniformLocation('uShininess'),
            uOpacity: shader.getUniformLocation('uOpacity'),        
            uIsLightSource: shader.getUniformLocation('uIsLightSource'),
            uSourceColor: shader.getUniformLocation('uSourceColor'),
            uFogColor: shader.getUniformLocation('uFogColor'),      
            uFogDensity: shader.getUniformLocation('uFogDensity')   
        },
    };

    // Geometriler
    geometryTemplates['cube'] = new Cube(gl);
    geometryTemplates['sphere'] = new Sphere(gl, 0.8, 30, 30);
    geometryTemplates['cylinder'] = new Cylinder(gl, 0.6, 1.5, 30);
    geometryTemplates['prism'] = new Cylinder(gl, 0.7, 2.0, 6);

    defaultTexture = loadTexture(gl, 'assets/box.jpg');

    camera = new Camera([0, 5, 15], [0, 1, 0], -90, -15);
    topCamera = new Camera([0, 30, 0], [0, 1, 0], -90, -90);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    initGUI(); 
    requestAnimationFrame(render);
}

// --- ASSETS PANEL ---
function generateAssetsPanel() {
    const container = document.getElementById('assetsContainer');
    container.innerHTML = ''; 

    projectAssets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
            <div class="asset-icon">${asset.icon}</div>
            <div class="asset-label">${asset.name}</div>
        `;
        card.onclick = () => handleAssetClick(asset);
        container.appendChild(card);
    });

    const divider = document.createElement('div');
    divider.style = "width:1px; height:50px; background:#444; margin:0 5px;";
    container.appendChild(divider);

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

function handleAssetClick(asset) {
    if (asset.type === 'primitive') {
        spawnObject(asset.id, asset.name);
    } 
    else if (asset.type === 'model') {
        ObjLoader.load(gl, 'assets/' + asset.file)
            .then(mesh => {
                const newObj = addObjectToScene(asset.name, 'custom', [0, 2, 0]);
                newObj.model = mesh;
                newObj.scale = [0.5, 0.5, 0.5];
                selectLastObject();
            })
            .catch(err => alert("Model yüklenemedi: assets/" + asset.file));
    }
    else if (asset.type === 'texture') {
        if (selectedObjectIndex === -1 || !objects[selectedObjectIndex]) {
            alert("Önce bir obje seçmelisin!");
            return;
        }
        const texture = loadTexture(gl, 'assets/' + asset.file);
        objects[selectedObjectIndex].texture = texture;
        objects[selectedObjectIndex].textureName = asset.name; 
        syncGUItoObject();
    }
}

// --- NESNE YÖNETİMİ ---
function addObjectToScene(name, type, position) {
    let finalName = name;
    let counter = 1;
    while(objects.some(o => o.name === finalName)) {
        finalName = `${name} (${counter++})`;
    }

    const obj = {
        name: finalName,
        type: type, 
        position: position || [0, 0, 0],
        rotation: [0, 0, 0], // X, Y, Z Rotasyonları
        scale: [1, 1, 1],
        texture: defaultTexture,
        textureName: "Varsayılan", 
        shininess: 32.0,
        opacity: 1.0,
        autoRotate: false,
        model: geometryTemplates[type] || null 
    };
    objects.push(obj);
    updateGUIList(); 
    return obj;
}

function spawnObject(type, baseName) {
    const x = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;
    const name = baseName || (type.charAt(0).toUpperCase() + type.slice(1));
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
let lightListController;

function initGUI() {
    gui = new dat.GUI({ width: 320 });

    const mainFolder = gui.addFolder('Sahne & Kamera');
    mainFolder.add(guiState, 'enableDualView').name('Çift Kamera');
    mainFolder.addColor(guiState, 'bgColor').name('Arkaplan');
    mainFolder.addColor(guiState, 'fogColor').name('Sis Rengi');
    mainFolder.add(guiState, 'fogDensity', 0.0, 0.1).name('Sis Yoğunluğu');
    
    // OBJE LİSTESİ
    const objNames = {}; 
    objListController = mainFolder.add(guiState, 'selectedName', objNames).name('SEÇİLİ OBJE')
        .onChange((val) => {
            selectedObjectIndex = parseInt(val);
            syncGUItoObject(); 
        });
    mainFolder.add(guiState, 'deleteSelected').name('Seçiliyi SİL');
    mainFolder.open();

    // TRANSFORM (GENİŞLETİLMİŞ LİMİTLER)
    const transformFolder = gui.addFolder('Transform & Materyal');
    // Limitleri -50 ile 50 arasına çıkardık
    transformFolder.add(guiState, 'posX', -50, 50).name('Pos X').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posY', -50, 50).name('Pos Y').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posZ', -50, 50).name('Pos Z').onChange(updateObjectFromGUI);
    
    transformFolder.add(guiState, 'scale', 0.1, 10.0).name('Boyut').onChange(updateObjectFromGUI);
    
    // 3 Eksenli Rotasyon
    transformFolder.add(guiState, 'rotX', 0, 360).name('Rot X').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'rotY', 0, 360).name('Rot Y').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'rotZ', 0, 360).name('Rot Z').onChange(updateObjectFromGUI);
    
    transformFolder.add(guiState, 'shininess', 1, 256).name('Parlaklık').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'opacity', 0.0, 1.0).name('Şeffaflık').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'autoRotate').name('Otomatik Dön').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'currentTextureName').name('Aktif Doku').listen(); 
    transformFolder.open();

    // IŞIK YÖNETİMİ
    const lightFolder = gui.addFolder('Işık Yönetimi (Çoklu)');
    
    // Işık Seçim Dropdown
    const lightNames = { "Ana Işık": 0, "Sol Lamba": 1, "Sağ Lamba": 2 };
    lightListController = lightFolder.add(guiState, 'selLightName', lightNames).name('SEÇİLİ IŞIK')
        .onChange((val) => {
            selectedLightIndex = parseInt(val);
            syncGUItoLight();
        });

    lightFolder.add(guiState, 'lActive').name('Açık/Kapalı').onChange(updateLightFromGUI);
    lightFolder.add(guiState, 'lType', { "Noktasal (Point)": 0, "Yönlü (Dir)": 1 }).name('Tipi').onChange(updateLightFromGUI);
    lightFolder.addColor(guiState, 'lColor').name('Rengi').onChange(updateLightFromGUI);
    lightFolder.add(guiState, 'lIntensity', 0.0, 5.0).name('Şiddeti').onChange(updateLightFromGUI);
    
    lightFolder.add(guiState, 'lPosX', -50, 50).name('Pos X').onChange(updateLightFromGUI);
    lightFolder.add(guiState, 'lPosY', -50, 50).name('Pos Y').onChange(updateLightFromGUI);
    lightFolder.add(guiState, 'lPosZ', -50, 50).name('Pos Z').onChange(updateLightFromGUI);
    lightFolder.open();

    // Başlangıç senkronizasyonu
    syncGUItoLight();
}

function updateGUIList() {
    if (!objListController) return;
    const select = objListController.domElement.querySelector('select');
    select.innerHTML = '';
    
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
        guiState.currentTextureName = "-";
        return;
    }
    const obj = objects[selectedObjectIndex];
    guiState.posX = obj.position[0];
    guiState.posY = obj.position[1];
    guiState.posZ = obj.position[2];
    guiState.scale = obj.scale[0]; 
    
    guiState.rotX = obj.rotation[0];
    guiState.rotY = obj.rotation[1];
    guiState.rotZ = obj.rotation[2];
    
    guiState.shininess = obj.shininess || 32.0;
    guiState.opacity = obj.opacity !== undefined ? obj.opacity : 1.0;
    guiState.autoRotate = !!obj.autoRotate;

    guiState.currentTextureName = obj.textureName || "Varsayılan";
    gui.updateDisplay();
}

function updateObjectFromGUI() {
    if (selectedObjectIndex === -1) return;
    const obj = objects[selectedObjectIndex];
    obj.position[0] = guiState.posX;
    obj.position[1] = guiState.posY;
    obj.position[2] = guiState.posZ;
    obj.scale = [guiState.scale, guiState.scale, guiState.scale];
    
    obj.rotation[0] = guiState.rotX;
    obj.rotation[1] = guiState.rotY;
    obj.rotation[2] = guiState.rotZ;
    
    obj.shininess = guiState.shininess;
    obj.opacity = guiState.opacity;
    obj.autoRotate = guiState.autoRotate;
}

// Işık GUI Senkronizasyonu
function syncGUItoLight() {
    const l = lights[selectedLightIndex];
    guiState.lActive = l.isActive; // DÜZELTME
    guiState.lType = l.type;
    guiState.lColor = l.color; // [r, g, b]
    guiState.lIntensity = l.intensity;
    guiState.lPosX = l.pos[0];
    guiState.lPosY = l.pos[1];
    guiState.lPosZ = l.pos[2];
    gui.updateDisplay();
}

function updateLightFromGUI() {
    const l = lights[selectedLightIndex];
    l.isActive = guiState.lActive; // DÜZELTME
    l.type = parseInt(guiState.lType);
    l.color = guiState.lColor;
    l.intensity = guiState.lIntensity;
    l.pos = [guiState.lPosX, guiState.lPosY, guiState.lPosZ];
}

// --- DOSYA YÜKLEME ---
function formatFileName(fileName) {
    let name = fileName.replace(/\.[^/.]+$/, "");
    name = name.replace(/_/g, " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function setupFileInputs() {
    document.getElementById('objInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const cleanName = formatFileName(file.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = ObjLoader.parse(e.target.result);
            const mesh = ObjLoader.createMesh(gl, data);
            const newObj = addObjectToScene(cleanName, 'custom', [0, 2, 0]);
            newObj.model = mesh;
            selectLastObject();
        };
        reader.readAsText(file);
        this.value = '';
    });

    document.getElementById('textureInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const cleanName = formatFileName(file.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const newTex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, newTex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.generateMipmap(gl.TEXTURE_2D);
                if (selectedObjectIndex !== -1) {
                    objects[selectedObjectIndex].texture = newTex;
                    objects[selectedObjectIndex].textureName = cleanName; 
                    syncGUItoObject(); 
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        this.value = '';
    });
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const pixel = new Uint8Array([128, 128, 128, 255]); 
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
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, activeCamera.position);
    
    // Sis
    const fogR = guiState.fogColor[0] / 255;
    const fogG = guiState.fogColor[1] / 255;
    const fogB = guiState.fogColor[2] / 255;
    gl.uniform3f(programInfo.uniformLocations.uFogColor, fogR, fogG, fogB);
    gl.uniform1f(programInfo.uniformLocations.uFogDensity, guiState.fogDensity);

    // --- IŞIKLARI SHADER'A GÖNDER ---
    for(let i=0; i<3; i++) {
        const l = lights[i];
        // Uniform isimlerini string olarak oluşturmak biraz maliyetlidir ama bu ölçekte sorun olmaz
        // uLights[0].position, uLights[1].position vb.
        const base = `uLights[${i}]`;
        
        // Bu değerlerin locationlarını main içinde cache'lemek daha iyidir ama kod sadeliği için burada yapıyoruz
        gl.uniform3f(gl.getUniformLocation(programInfo.program, `${base}.position`), l.pos[0], l.pos[1], l.pos[2]);
        gl.uniform1i(gl.getUniformLocation(programInfo.program, `${base}.type`), l.type);
        gl.uniform3f(gl.getUniformLocation(programInfo.program, `${base}.color`), l.color[0]/255, l.color[1]/255, l.color[2]/255);
        gl.uniform1f(gl.getUniformLocation(programInfo.program, `${base}.intensity`), l.intensity);
        
        // DÜZELTME: .active -> .isActive
        gl.uniform1i(gl.getUniformLocation(programInfo.program, `${base}.isActive`), l.isActive ? 1 : 0);
        
        // IŞIK GÖRSELİ (KÜP) ÇİZİMİ
        if(l.isActive) { // DÜZELTME: l.active -> l.isActive
            gl.uniform1i(programInfo.uniformLocations.uIsLightSource, 1);
            // Işığın kendi rengini gönder
            gl.uniform3f(programInfo.uniformLocations.uSourceColor, l.color[0]/255, l.color[1]/255, l.color[2]/255);
            
            let lightModel = mat4.create();
            mat4.translate(lightModel, lightModel, l.pos);
            mat4.scale(lightModel, lightModel, [0.2, 0.2, 0.2]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, lightModel);
            let ln = mat3.create();
            gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, ln);
            geometryTemplates['cube'].draw(programInfo);
        }
    }

    // --- DİĞER OBJELERİ ÇİZ ---
    gl.uniform1i(programInfo.uniformLocations.uIsLightSource, 0);

    objects.forEach(obj => {
        if (!obj.model) return; 

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

        gl.uniform1f(programInfo.uniformLocations.uShininess, obj.shininess || 32.0);
        gl.uniform1f(programInfo.uniformLocations.uOpacity, obj.opacity !== undefined ? obj.opacity : 1.0);

        let modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, obj.position);
        
        if(obj.autoRotate) {
             obj.rotation[1] += 1.0; 
             if(obj.rotation[1] > 360) obj.rotation[1] -= 360;
             if(objects[selectedObjectIndex] === obj) guiState.rotY = obj.rotation[1];
        }
        
        // 3 Eksenli Rotasyon Uygulaması (Order: Y -> X -> Z)
        mat4.rotate(modelMatrix, modelMatrix, obj.rotation[1] * Math.PI / 180, [0, 1, 0]); // Y (Yaw)
        mat4.rotate(modelMatrix, modelMatrix, obj.rotation[0] * Math.PI / 180, [1, 0, 0]); // X (Pitch)
        mat4.rotate(modelMatrix, modelMatrix, obj.rotation[2] * Math.PI / 180, [0, 0, 1]); // Z (Roll)
        
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