/* ═══════════════════════════════════════════════
   OPSPILOT KITCHENS — 3D Viewer
   Phase 2: Basic 3D Visualization
   ═══════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODULE_TYPES } from './catalog.js';

let scene, camera, renderer, controls;
let container;
let isInitialized = false;
let isAnimating = false;
let reqId;

const COLORS = {
    background: 0xf0f0f0, // White bone / light gray
    floor: 0x2a2a2a,      // Dark gray
    wall: 0xe5e7eb,       // Light gray (bone)
    moduleBase: 0x39ce86, // Green
    moduleWall: 0x86efac, // Light Green
    moduleTall: 0x15803d, // Dark Green
    countertop: 0x1f2937, // Dark slate
};

export function init3D(domContainer) {
    if (isInitialized) return;
    container = domContainer;

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 50000);
    camera.position.set(2000, 3000, 5000);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 5. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 5000, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1500, 3000, 1500);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 4000;
    dirLight.shadow.camera.bottom = -4000;
    dirLight.shadow.camera.left = -4000;
    dirLight.shadow.camera.right = 4000;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Add a floor plane
    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Handle Resize
    window.addEventListener('resize', handleResize);

    isInitialized = true;
    startLoop();
}

function handleResize() {
    if (!camera || !renderer || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function startLoop() {
    if (isAnimating) return;
    isAnimating = true;
    animate();
}

function animate() {
    if (!isAnimating) return;
    reqId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

export function stop3D() {
    isAnimating = false;
    cancelAnimationFrame(reqId);
}

export function render3D(state) {
    if (!isInitialized) return;

    // Clear previous meshes (except lights and floor which are permanent)
    // Or better, just group them
    const objectsToRemove = [];
    scene.traverse((child) => {
        if (child.isMesh && child.userData.isGenerated) {
            objectsToRemove.push(child);
        }
    });
    objectsToRemove.forEach((obj) => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });

    // 1. Generate Walls
    state.walls.forEach(wall => {
        generateWall(wall, state.ceilingHeight);
    });

    // 2. Generate Modules
    if (state.placed_modules) {
        state.placed_modules.forEach(mod => {
            generateModule(mod, state.walls);
        });
    }
}

function generateWall(wall, height) {
    // Simple Box approach for MVP.
    // We need start and end coordinates based on wall ID and shape logic.
    // This duplicates logic from canvas.js which is not ideal, but acceptable for MVP.
    // Assumption:
    // Wall A: Starts at (0,0), goes +X
    // Wall B: Starts at (0,0), goes +Z (if L-shape/U-shape left side) or starts at Wall A end (if L-shape right side?)
    // Let's check state.js/canvas.js logic:
    // canvas.js: Wall A horizontal. Wall B vertical (starts at origin).
    // So:
    // Wall A: from (0,0) to (Length, 0)
    // Wall B: from (0,0) to (0, Length)

    let x = 0, z = 0, w = 0, d = 0, angle = 0;
    const THICKNESS = 100; // 10cm wall thickness for 3D

    if (wall.id === 'wall-A') {
        // Horizontal along X
        w = wall.length;
        d = THICKNESS;
        x = w / 2;
        z = -d / 2; // Behind the Z=0 line
    } else if (wall.id === 'wall-B') {
        // Vertical along Z (from 0,0 downwards in Z)
        // Actually in canvas.js it goes down (positive Y). In 3D +Y is Up. So +Z is "down" in 2D top-down view.
        w = THICKNESS;
        d = wall.length;
        x = -w / 2; // Left of X=0
        z = d / 2;
    } else if (wall.id === 'wall-C') {
        // U-Shape logic:
        // If A is top, B is left, C is right?
        // Canvas: "Wall C starts at the end of Wall A" logic wasn't fully implemented in canvas.js U-shape bbox logic for drawing.
        // But let's assume standard U-shape for the future.
        // For now, let's just render if id is A or B.
        return;
    }

    const geo = new THREE.BoxGeometry(w, height, d);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.wall });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isGenerated = true;
    scene.add(mesh);

    // Obstacles (Windows/Doors) - Booleans are hard.
    // MVP: Render a "hole" visual by adding a black box intersecting? Or just ignore for now.
    // Optimization: Just render two wall segments if there's a door.
    // For now: Ignore obstacles in 3D wall geometry (solid walls) but Modules will respect them.
}

function generateModule(mod, walls) {
    // Position logic matches canvas.js
    // Base modules: Z=0 to Z=600 (depth) for Wall A
    // Wall modules: Z=0 to Z=350, Y=Above Counter

    const wall = walls.find(w => w.id === mod.wallId);
    if (!wall && !mod.corner) return;

    const width = mod.width;
    const depth = mod.type === MODULE_TYPES.WALL ? 350 : 600;
    const height = mod.type === MODULE_TYPES.BASE ? 900 : (mod.type === MODULE_TYPES.TALL ? 2150 : 800);

    let x = 0, y = 0, z = 0;
    let rotation = 0;

    // Vertical position
    if (mod.type === MODULE_TYPES.WALL) {
        y = 1500 + height / 2; // Approx 150cm from floor
    } else {
        y = height / 2; // Base/Tall sits on floor
    }

    // Horizontal/Depth position
    // Wall A moves along X
    // Wall B moves along Z

    if (mod.corner) {
        // Special corner handling
        // L-shape corner module usually 930x930
        if (mod.wallId === 'corner-AB') {
            // It's at 0,0
            x = width / 2;
            z = width / 2;

            // Simple box for corner
            const geo = new THREE.BoxGeometry(width, height, width);
            // Actually L-shape corner is complex. Box is fine for MVP.
            // Better: Two boxes? No, keep it simple.
            const mat = new THREE.MeshStandardMaterial({ color: COLORS.moduleBase });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(width / 2, y, width / 2); // Offset from 0,0
            mesh.userData.isGenerated = true;
            scene.add(mesh);
            return;
        }
    }

    if (mod.wallId === 'wall-A') {
        x = mod.position + width / 2;
        z = depth / 2; // Extends from 0 to +600
        rotation = 0;
    } else if (mod.wallId === 'wall-B') {
        x = depth / 2; // Extends from 0 to +600 along X? No, Wall B is along Z, so depth is along X.
        z = mod.position + width / 2;
        rotation = -Math.PI / 2;
        // Wait, if Wall B is along Z, Modules stick out in +X direction?
        // Wall B is at X=-wallThickness. Modules are at X=0..depth.
        // Yes.
    }

    const geo = new THREE.BoxGeometry(width, height, depth);
    let color = COLORS.moduleBase;
    if (mod.type === MODULE_TYPES.WALL) color = COLORS.moduleWall;
    if (mod.type === MODULE_TYPES.TALL) color = COLORS.moduleTall;

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isGenerated = true;

    scene.add(mesh);

    // Add Countertop for Base modules
    if (mod.type === MODULE_TYPES.BASE) {
        const ctGeo = new THREE.BoxGeometry(width, 40, depth + 20); // +20 overhang
        const ctMat = new THREE.MeshStandardMaterial({ color: COLORS.countertop });
        const ct = new THREE.Mesh(ctGeo, ctMat);
        ct.position.set(0, height / 2 + 20, 10); // Local relative
        mesh.add(ct);
    }
}
