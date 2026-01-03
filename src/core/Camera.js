const { vec3, mat4 } = glMatrix;

/**
 * Camera Class
 * Handles 3D navigation within the scene using Euler Angles (Yaw, Pitch).
 * Implements a First Person Controller style movement (WASD + Mouse Look).
 */
export class Camera {
    /**
     * Creates a new Camera instance.
     * @param {Array} position - Initial position of the camera (x, y, z)
     * @param {Array} up - World up vector (usually [0, 1, 0])
     * @param {number} yaw - Horizontal rotation (default: -90)
     * @param {number} pitch - Vertical rotation (default: 0)
     */
    constructor(position = [0, 0, 5], up = [0, 1, 0], yaw = -90, pitch = 0) {
        // Camera Attributes
        this.position = vec3.fromValues(...position);
        this.worldUp = vec3.fromValues(...up);
        this.yaw = yaw;
        this.pitch = pitch;
        
        // Direction Vectors
        this.front = vec3.create();
        this.up = vec3.create();
        this.right = vec3.create();

        // Camera Options
        this.sensitivity = 0.1; // Mouse sensitivity for look adjustments

        this.updateCameraVectors();
    }

    /**
     * Calculates and returns the View Matrix based on position and target.
     * Used in the Vertex Shader to transform World Coordinates to View Coordinates.
     * @returns {mat4} The calculated view matrix (LookAt)
     */
    getViewMatrix() {
        const target = vec3.create();
        vec3.add(target, this.position, this.front);
        
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, this.position, target, this.up);
        return viewMatrix;
    }

    // --- Keyboard Movement Methods ---

    /**
     * Moves the camera forward in the direction it is facing.
     * @param {number} speed - Movement speed (delta time * velocity)
     */
    moveForward(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.front, speed);
        vec3.add(this.position, this.position, offset);
    }

    /**
     * Moves the camera to the right (strafing).
     * @param {number} speed - Movement speed
     */
    moveRight(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.right, speed);
        vec3.add(this.position, this.position, offset);
    }

    /**
     * Moves the camera vertically upwards (flying).
     * @param {number} speed - Movement speed
     */
    moveUp(speed) {
        const offset = vec3.create();
        vec3.scale(offset, this.up, speed);
        vec3.add(this.position, this.position, offset);
    }

    // --- Mouse Interaction ---

    /**
     * Processes mouse movement to update Euler angles (Yaw and Pitch).
     * @param {number} xoffset - Change in X mouse position
     * @param {number} yoffset - Change in Y mouse position
     * @param {boolean} constrainPitch - Whether to limit vertical rotation to prevent flipping
     */
    processMouseMovement(xoffset, yoffset, constrainPitch = true) {
        xoffset *= this.sensitivity;
        yoffset *= this.sensitivity;

        this.yaw += xoffset;
        this.pitch -= yoffset; // Subtracting because y-coordinates range from bottom to top

        // Constrain the pitch to prevent the camera from flipping over (gimbal lock prevention)
        if (constrainPitch) {
            if (this.pitch > 89.0) this.pitch = 89.0;
            if (this.pitch < -89.0) this.pitch = -89.0;
        }

        this.updateCameraVectors();
    }

    /**
     * Calculates the front vector from the Camera's (Euler) Angles.
     * Uses Trigonometry to convert Spherical coordinates to Cartesian coordinates.
     */
    updateCameraVectors() {
        const front = vec3.create();
        const rad = Math.PI / 180; // Degrees to radians conversion factor
        
        // Calculate the new Front vector
        front[0] = Math.cos(this.yaw * rad) * Math.cos(this.pitch * rad);
        front[1] = Math.sin(this.pitch * rad);
        front[2] = Math.sin(this.yaw * rad) * Math.cos(this.pitch * rad);
        
        vec3.normalize(this.front, front);

        // Re-calculate the Right and Up vectors
        // Normalize the vectors because their length gets closer to 0 the more you look up or down
        vec3.cross(this.right, this.front, this.worldUp);  
        vec3.normalize(this.right, this.right);
        
        vec3.cross(this.up, this.right, this.front);
        vec3.normalize(this.up, this.up);
    }
}