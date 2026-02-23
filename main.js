import { Renderer } from './engine/renderer.js';
import { Shader } from './engine/shader.js';
import { Camera } from './engine/camera.js';
import { Mesh } from './engine/mesh.js';
import { Frustum } from './culling/frustum.js';

let useFrustum = true; // Defaultnya nyala

document.getElementById('toggleFrustum').addEventListener('change', (e) => {
    useFrustum = e.target.checked;
    // Tambahkan ini biar kita bisa lihat di Inspect Element > Console
    console.log("Status Frustum Culling sekarang:", useFrustum);
});

const renderer = new Renderer('gameCanvas');
const gl = renderer.gl;

// 1. Modifikasi Shader untuk Pencahayaan
const vertexShaderCode = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal; // Menerima data normal dari mesh

    uniform vec4 uOffset; 
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    
    varying vec3 vNormal; // Kirim data normal ke Fragment Shader

    void main() {
        vec4 finalPosition = aVertexPosition + uOffset;
        gl_Position = uProjectionMatrix * uViewMatrix * finalPosition;
        vNormal = aVertexNormal; 
    }
`;

const fragmentShaderCode = `
    precision mediump float;
    varying vec3 vNormal;
    uniform vec3 uLightDirection; 
    uniform vec3 uBaseColor; 

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightDirection);
        
        // Kita kurangi efek bayangan gelap, biar kubusnya terang benderang
        float diffuse = max(dot(normal, lightDir), 0.0);
        
        // Warna dasar (Emissive/Neon) yang kuat
        vec3 baseNeon = uBaseColor * 0.9; 
        // Highlight tambahan di sisi yang kena cahaya biar tetap kelihatan 3D
        vec3 highlight = uBaseColor * diffuse * 0.6;
        
        gl_FragColor = vec4(baseNeon + highlight, 1.0); 
    }
`;

const shader = new Shader(gl, vertexShaderCode, fragmentShaderCode);
const cube = new Mesh(gl);

const aspect = renderer.canvas.width / renderer.canvas.height;
// Jarak pandang kamera kita jauhkan sampai 200 supaya kelihatan luas
const camera = new Camera(Math.PI / 4, aspect, 0.1, 2000.0);
const frustum = new Frustum();
// Kamera ditarik agak jauh ke belakang dan ke atas
camera.position = [0, 0, 0];
camera.updateViewMatrix();

const viewLocation = gl.getUniformLocation(shader.program, "uViewMatrix");
const projectionLocation = gl.getUniformLocation(shader.program, "uProjectionMatrix");
const offsetLocation = gl.getUniformLocation(shader.program, "uOffset");

// Arah matahari: datang dari kanan atas depan
const lightDirLocation = gl.getUniformLocation(shader.program, "uLightDirection");
const lightDirection = [0.8, 1.0, 0.5];

// Ambil jalur komunikasi untuk warna
const baseColorLocation = gl.getUniformLocation(shader.program, "uBaseColor");

// DATA KUBUS
const JUMLAH_KUBUS = 50000; // JUMLAH KUBUS
const cubeData = []; // Kita ganti namanya biar enak
for (let i = 0; i < JUMLAH_KUBUS; i++) {
    cubeData.push({
        pos: [
            (Math.random() - 0.5) * 1000, // Tersebar dari -500 sampai +500
            (Math.random() - 0.5) * 1000,
            (Math.random() - 0.5) * 1000
        ],
        // ... (bagian warna biarkan sama) ...
        color: [
            Math.random(), // Red
            Math.random(), // Green
            Math.random()  // Blue
        ]
    });
}

// --- SISTEM KONTROL KEYBOARD ---
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Kecepatan jalan dan menoleh
const speed = 1.0;
const turnSpeed = 0.03;

function updateCameraMovement() {
    // Maju (W) dan Mundur (S)
    if (keys['KeyW']) {
        camera.position[0] += Math.sin(camera.yaw) * speed;
        camera.position[2] -= Math.cos(camera.yaw) * speed;
    }
    if (keys['KeyS']) {
        camera.position[0] -= Math.sin(camera.yaw) * speed;
        camera.position[2] += Math.cos(camera.yaw) * speed;
    }

    // Geser Kiri (A) dan Kanan (D)
    if (keys['KeyA']) {
        camera.position[0] -= Math.cos(camera.yaw) * speed;
        camera.position[2] -= Math.sin(camera.yaw) * speed;
    }
    if (keys['KeyD']) {
        camera.position[0] += Math.cos(camera.yaw) * speed;
        camera.position[2] += Math.sin(camera.yaw) * speed;
    }

    // Menoleh dengan Tombol Panah
    if (keys['ArrowLeft']) camera.yaw -= turnSpeed;
    if (keys['ArrowRight']) camera.yaw += turnSpeed;
    if (keys['ArrowUp']) camera.pitch += turnSpeed;
    if (keys['ArrowDown']) camera.pitch -= turnSpeed;

    // Terapkan perubahan posisi
    camera.updateViewMatrix();
}
// -------------------------------

// --- VARIABEL UNTUK FPS METER ---
const fpsElement = document.getElementById('fpsCounter');
let lastTime = performance.now();
let frameCount = 0;
// --------------------------------



// 3. Game Loop
function gameLoop() {
    renderer.render();
    shader.use();
    updateCameraMovement()

    gl.uniformMatrix4fv(viewLocation, false, camera.viewMatrix);
    gl.uniformMatrix4fv(projectionLocation, false, camera.projectionMatrix);
    // Kirim arah cahaya ke GPU
    gl.uniform3fv(lightDirLocation, lightDirection);

    // Update data frustum berdasarkan posisi kamera terbaru
    frustum.update(camera.projectionMatrix, camera.viewMatrix);

    let drawnObjects = 0; // Hitung berapa yang berhasil lolos sensor!

    // Gambar ke-50.000 kubus (tapi dicegat dulu sama culling!)
    for (let i = 0; i < JUMLAH_KUBUS; i++) {
        const data = cubeData[i];

        // 1. Defaultnya kita anggap kubus ini terlihat
        let isVisible = true;

        // 2. Kalau toggle UI nyala, baru cek pakai rumus matematika
        if (useFrustum) {
            isVisible = frustum.containsSphere(data.pos[0], data.pos[1], data.pos[2], 1.73);
        }

        // 3. Kalau dia isVisible == true (baik karena masuk layar ATAU karena culling dimatikan)
        if (isVisible) {
            gl.uniform4f(offsetLocation, data.pos[0], data.pos[1], data.pos[2], 0.0);
            gl.uniform3f(baseColorLocation, data.color[0], data.color[1], data.color[2]);
            cube.draw(shader.program);

            drawnObjects++;
        }
    }

    // --- LOGIKA MENGHITUNG FPS ---
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
        // Tampilkan berapa yang digambar vs total kubus!
        fpsElement.innerText = `FPS: ${frameCount} | Rendered: ${drawnObjects} / ${JUMLAH_KUBUS}`;
        frameCount = 0;
        lastTime = currentTime;
    }

    // --- STATE UNTUK METODE CULLING ---

// ----------------------------------

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);