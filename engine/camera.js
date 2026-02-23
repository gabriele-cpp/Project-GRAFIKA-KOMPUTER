import { mat4 } from './math.js';

export class Camera {
    constructor(fov, aspect, near, far) {
        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();
        mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

        // Posisi awal kamera di tengah lautan kubus
        this.position = [0, 0, 80];

        // Sudut rotasi kamera
        this.yaw = 0;   // Menoleh kiri/kanan
        this.pitch = 0; // Mendongak/menunduk
        this.up = [0, 1, 0];

        this.updateViewMatrix();
    }

    updateViewMatrix() {
        // Batasi biar nggak bisa salto (nanti pusing liatnya)
        if (this.pitch > Math.PI / 2.1) this.pitch = Math.PI / 2.1;
        if (this.pitch < -Math.PI / 2.1) this.pitch = -Math.PI / 2.1;

        // Matematika Trigonometri untuk menentukan arah pandangan
        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);

        // Hitung arah depan (Z negatif adalah "depan" di WebGL)
        const dirX = cosPitch * sinYaw;
        const dirY = sinPitch;
        const dirZ = cosPitch * -cosYaw;

        // Tentukan titik target yang sedang dilihat
        this.target = [
            this.position[0] + dirX,
            this.position[1] + dirY,
            this.position[2] + dirZ
        ];

        // Perbarui matriks kamera
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }
}