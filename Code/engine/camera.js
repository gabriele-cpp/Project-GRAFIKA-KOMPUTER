import { mat4 } from './math.js';

export class Camera {
    constructor(fov, aspect, near, far) {
        this.fov    = fov;
        this.aspect = aspect;
        this.near   = near;
        this.far    = far;

        this.projectionMatrix = mat4.create();
        this.viewMatrix       = mat4.create();
        mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

        this.position = [0, 0, 80];
        this.yaw      = 0;
        this.pitch    = 0;
        this.up       = [0, 1, 0];

        // simpan arah pandang untuk occlusion
        this.forward  = [0, 0, -1];

        this.updateViewMatrix();
    }

    updateAspect(aspect) {
        this.aspect = aspect;
        mat4.perspective(this.projectionMatrix, this.fov, aspect, this.near, this.far);
    }

    updateViewMatrix() {
        if (this.pitch >  Math.PI/2.1) this.pitch =  Math.PI/2.1;
        if (this.pitch < -Math.PI/2.1) this.pitch = -Math.PI/2.1;

        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const cosYaw   = Math.cos(this.yaw);
        const sinYaw   = Math.sin(this.yaw);

        const dirX = cosPitch * sinYaw;
        const dirY = sinPitch;
        const dirZ = cosPitch * -cosYaw;

        // Simpan vektor arah untuk dipakai occlusion culling
        this.forward = [dirX, dirY, dirZ];

        this.target = [
            this.position[0] + dirX,
            this.position[1] + dirY,
            this.position[2] + dirZ
        ];

        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }
}
