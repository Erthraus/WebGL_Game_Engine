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
// Geometri şablonları (Tekrar tekrar buffer oluşturmamak için)
let geometryTemplates = {}; 
let defaultTexture;

let camera;     
let topCamera;  
const keysPressed = {}; 
let projectionMatrix = mat4.create();

// YENİ: Sahnedeki Tüm Objeler Burada Tutulacak
const objects = []; 
let selectedObjectIndex = 0; // Şu an düzenlenen objenin indisi

let gui;
// GUI ile senkronize çalışacak geçici ayarlar
const guiState = {
    // Genel
    enableDualView: false,
    bgColor: [25, 25, 25],
    
    // Seçim
    selectedName: "", // Dropdown menüsü için
    
    // Transform (Seçili obje için)
    posX: 0, posY: 0, posZ: 0,
    scale: 1,
    rotX: 0, rotY: 0, rotZ: 0,
    
    // Işık
    lightX: 5, lightY: 10, lightZ: 5
};

// Shader kodları (Aynı)
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

    setupAssetsPanel(); // HTML butonlarını bağla
    setupFileInputs();  // Dosya yüklemeyi bağla

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

    // --- BAŞLANGIÇ NESNELERİ ---
    // Geometreleri bir kez oluşturup şablonda saklayalım
    geometryTemplates['cube'] = new Cube(gl);
    geometryTemplates['sphere'] = new Sphere(gl, 0.8, 30, 30);
    geometryTemplates['cylinder'] = new Cylinder(gl, 0.6, 1.5, 30);
    // Prizma aslında 6 segmentli silindirdir
    geometryTemplates['prism'] = new Cylinder(gl, 0.7, 2.0, 6);

    defaultTexture = loadTexture(gl, 'assets/box.jpg');

    // Sahneye varsayılan objeleri ekle
    addObjectToScene('Küp', 'cube', [-2.5, 0, 0]);
    addObjectToScene('Küre', 'sphere', [0, 0, 0]);
    addObjectToScene('Silindir', 'cylinder', [2.5, 0, 0]);
    addObjectToScene('Prizma', 'prism', [-5.0, 0, 0]);

    // Araba Modeli (Varsayılan olarak yüklenmeye çalışır)
    ObjLoader.load(gl, 'assets/car.obj').then(mesh => {
        const carObj = addObjectToScene('Araba', 'custom', [0, 0, -3]);
        carObj.model = mesh; 
        carObj.scale = [0.5, 0.5, 0.5];
        // Yüklendiği an seçimi güncelle
        syncGUItoObject();
    }).catch(e => console.log("Varsayılan model (car.obj) bulunamadı veya yüklenemedi."));

    camera = new Camera([0, 2, 10], [0, 1, 0], -90, 0);
    topCamera = new Camera([0, 20, 0], [0, 1, 0], -90, -90);

    initGUI(); // Arayüzü başlat

    requestAnimationFrame(render);
}

// --- NESNE YÖNETİMİ ---

// Sahneye yeni bir obje ekler ve listeye kaydeder
function addObjectToScene(name, type, position) {
    const obj = {
        name: name,
        type: type, // 'cube', 'sphere', 'custom' vb.
        position: position || [0, 0, 0],
        rotation: [0, 0, 0], // Derece cinsinden [x, y, z]
        scale: [1, 1, 1],
        texture: defaultTexture,
        model: geometryTemplates[type] || null // Render edilecek asıl veri
    };
    objects.push(obj);
    updateGUIList(); // GUI listesini güncelle
    return obj;
}

// Assets panelinden veya GUI'den çağrılan spawn fonksiyonu
function spawnObject(type) {
    const x = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;
    // Benzersiz isim oluştur
    const name = type.charAt(0).toUpperCase() + type.slice(1) + " " + (objects.length + 1);
    
    addObjectToScene(name, type, [x, 0, z]);
    
    // Yeni eklenen objeyi otomatik seç
    selectedObjectIndex = objects.length - 1;
    syncGUItoObject();
}

function deleteSelectedObject() {
    if (objects.length === 0) return;
    objects.splice(selectedObjectIndex, 1);
    
    // Seçimi düzelt
    if (selectedObjectIndex >= objects.length) selectedObjectIndex = objects.length - 1;
    if (selectedObjectIndex < 0) selectedObjectIndex = 0;
    
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
    
    // Obje Listesi (Dropdown)
    const objNames = {}; 
    objects.forEach((o, i) => objNames[o.name] = i);
    
    objListController = mainFolder.add(guiState, 'selectedName', objNames).name('SEÇİLİ OBJE')
        .onChange((val) => {
            selectedObjectIndex = parseInt(val);
            syncGUItoObject(); // Seçim değişince sliderları güncelle
        });

    mainFolder.open();

    const transformFolder = gui.addFolder('Obje Ayarları (Transform)');
    transformFolder.add(guiState, 'posX', -20, 20).name('Pozisyon X').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posY', -10, 20).name('Pozisyon Y').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'posZ', -20, 20).name('Pozisyon Z').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'scale', 0.1, 5.0).name('Boyut').onChange(updateObjectFromGUI);
    transformFolder.add(guiState, 'rotY', 0, 360).name('Dönüş Y').onChange(updateObjectFromGUI);
    transformFolder.open();

    const lightFolder = gui.addFolder('Işık');
    lightFolder.add(guiState, 'lightX', -20, 20);
    lightFolder.add(guiState, 'lightY', -20, 20);
    lightFolder.add(guiState, 'lightZ', -20, 20);

    // İlk başta seçimi senkronize et
    syncGUItoObject();
}

// Obje listesi değişince Dropdown menüsünü güncelle
function updateGUIList() {
    if (!objListController) return;
    
    // dat.GUI'nin select elementini manuel temizleyip yeniden dolduruyoruz
    const select = objListController.domElement.querySelector('select');
    select.innerHTML = '';
    objects.forEach((o, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = o.name;
        select.add(opt);
    });
    
    // Geçerli değeri ayarla
    objListController.setValue(selectedObjectIndex);
}

// Seçili objenin değerlerini GUI'ye aktar (Okuma)
function syncGUItoObject() {
    if (objects.length === 0) return;
    const obj = objects[selectedObjectIndex];
    
    guiState.posX = obj.position[0];
    guiState.posY = obj.position[1];
    guiState.posZ = obj.position[2];
    guiState.scale = obj.scale[0]; 
    guiState.rotY = obj.rotation[1];

    // dat.GUI'yi görsel olarak güncelle
    gui.updateDisplay();
}

// GUI'deki slider değişince objeyi güncelle (Yazma)
function updateObjectFromGUI() {
    if (objects.length === 0) return;
    const obj = objects[selectedObjectIndex];

    obj.position[0] = guiState.posX;
    obj.position[1] = guiState.posY;
    obj.position[2] = guiState.posZ;
    obj.scale = [guiState.scale, guiState.scale, guiState.scale];
    obj.rotation[1] = guiState.rotY;
}

// --- DOSYA VE PANEL YÖNETİMİ ---

function setupAssetsPanel() {
    document.getElementById('btnSpawnCube').addEventListener('click', () => spawnObject('cube'));
    document.getElementById('btnSpawnSphere').addEventListener('click', () => spawnObject('sphere'));
    document.getElementById('btnSpawnCylinder').addEventListener('click', () => spawnObject('cylinder'));

    // Model Yükle
    document.getElementById('btnImportModel').addEventListener('click', () => {
        document.getElementById('objInput').click();
    });

    // Doku Yükle
    document.getElementById('btnImportTexture').addEventListener('click', () => {
        document.getElementById('textureInput').click();
    });

    // Sil
    document.getElementById('btnRemoveSelected').addEventListener('click', () => {
        deleteSelectedObject();
    });

    // Temizle
    document.getElementById('btnClearScene').addEventListener('click', () => {
        if(confirm("Tüm sahneyi temizlemek istediğinize emin misiniz?")) {
            objects.length = 0;
            updateGUIList();
        }
    });
}

function setupFileInputs() {
    // OBJ Yükleme
    document.getElementById('objInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = ObjLoader.parse(e.target.result);
            const mesh = ObjLoader.createMesh(gl, data);
            
            // Yeni bir obje olarak ekle
            const name = "Model " + (objects.length + 1);
            const newObj = addObjectToScene(name, 'custom', [0, 2, 0]);
            newObj.model = mesh;
            
            selectedObjectIndex = objects.length - 1;
            syncGUItoObject();
        };
        reader.readAsText(file);
        this.value = '';
    });

    // Texture Yükleme
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

                // Sadece SEÇİLİ objenin dokusunu değiştir
                if (objects[selectedObjectIndex]) {
                    objects[selectedObjectIndex].texture = newTex;
                }
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
    const pixel = new Uint8Array([100, 100, 100, 255]); // Varsayılan gri
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
    
    // Kamera Hareketi
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
        
        // Sol Ekran
        gl.viewport(0, 0, halfWidth, height);
        gl.scissor(0, 0, halfWidth, height);
        gl.clearColor(r, g, b, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawScene(now, camera, aspect => mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0));

        // Sağ Ekran
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

    // --- TÜM OBJELERİ LİSTEDEN ÇİZ ---
    objects.forEach(obj => {
        if (!obj.model) return; 

        // Texture Bağla
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