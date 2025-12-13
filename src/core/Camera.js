const { vec3, mat4 } = glMatrix;

export class Camera {
    constructor(position = [0, 0, 5], up = [0, 1, 0], yaw = -90, pitch = 0) {
        // Kamera özellikler
        this.position = vec3.fromValues(...position);
        this.worldUp = vec3.fromValues(...up);
        this.yaw = yaw;
        this.pitch = pitch;
        
        this.front = vec3.create();
        this.up = vec3.create();
        this.right = vec3.create();

        // Ayarlar
        this.sensitivity = 0.1; // Fare hassasiyeti

        this.updateCameraVectors();
    }

    getViewMatrix() {
        const target = vec3.create();
        vec3.add(target, this.position, this.front);
        
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, this.position, target, this.up);
        return viewMatrix;
    }

    // Klavye Hareketi
    moveForward(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.front, speed);
        vec3.add(this.position, this.position, offset);
    }

    moveRight(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.right, speed);
        vec3.add(this.position, this.position, offset);
    }

    moveUp(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.up, speed);
        vec3.add(this.position, this.position, offset);
    }

    // YENİ: Fare Hareketi
    processMouseMovement(xoffset, yoffset, constrainPitch = true) {
        xoffset *= this.sensitivity;
        yoffset *= this.sensitivity;

        this.yaw += xoffset;
        this.pitch -= yoffset; // Y koordinatı genelde yukarı çıktıkça azalır, o yüzden çıkarıyoruz

        // Kafanın arkasına dönmeyi engelle (Takla atmamak için)
        if (constrainPitch) {
            if (this.pitch > 89.0) this.pitch = 89.0;
            if (this.pitch < -89.0) this.pitch = -89.0;
        }

        this.updateCameraVectors();
    }

    // Açıları vektöre çevir (Trigonometri)
    updateCameraVectors() {
        const front = vec3.create();
        const rad = Math.PI / 180; // Dereceyi radyana çevirme çarpanı
        
        // Küresel koordinatlardan Kartezyen koordinatlara dönüşüm
        front[0] = Math.cos(this.yaw * rad) * Math.cos(this.pitch * rad);
        front[1] = Math.sin(this.pitch * rad);
        front[2] = Math.sin(this.yaw * rad) * Math.cos(this.pitch * rad);
        
        vec3.normalize(this.front, front);

        // Sağ ve Yukarı vektörlerini yeniden hesapla
        vec3.cross(this.right, this.front, this.worldUp);  
        vec3.normalize(this.right, this.right);
        
        vec3.cross(this.up, this.right, this.front);
        vec3.normalize(this.up, this.up);
    }
}