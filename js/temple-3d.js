import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Temple3D = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  hotspots: [],
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  container: null,
  overlayContainer: null,
  animationId: null,
  isInitialized: false,
  model: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.overlayContainer = document.getElementById('hotspot-overlay');

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 500);
    this.camera.position.set(30, 18, 30);
    this.camera.lookAt(0, 4, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 4, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.3;

    // Lighting
    this.addLighting();

    // Load GLB model
    this.loadModel();

    // Hotspots
    this.createHotspots();

    // Events
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));

    document.getElementById('model-zoom-in')?.addEventListener('click', () => {
      this.camera.position.multiplyScalar(0.85);
      this.controls.update();
    });
    document.getElementById('model-zoom-out')?.addEventListener('click', () => {
      this.camera.position.multiplyScalar(1.15);
      this.controls.update();
    });
    document.getElementById('model-reset')?.addEventListener('click', () => {
      this.camera.position.set(30, 18, 30);
      this.controls.target.set(0, 4, 0);
      this.controls.update();
    });

    this.isInitialized = true;
    this.animate();
  },

  addLighting() {
    // Warm ambient
    const ambient = new THREE.AmbientLight(0xFFF3E0, 0.7);
    this.scene.add(ambient);

    // Main sun
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.4);
    sun.position.set(25, 35, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // Sky hemisphere
    const skyLight = new THREE.HemisphereLight(0xCCE0FF, 0x8D7E6F, 0.4);
    this.scene.add(skyLight);

    // Back fill
    const backLight = new THREE.DirectionalLight(0xFFDDA0, 0.5);
    backLight.position.set(-25, 18, -18);
    this.scene.add(backLight);
  },

  // ============ LOAD GLB MODEL ============
  loadModel() {
    const loader = new GLTFLoader();

    // Ground plane
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    loader.load(
      'models/palace.glb',
      (gltf) => {
        this.model = gltf.scene;

        // Enable shadows on all meshes
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Auto-center and scale the model
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Scale to fit nicely (target ~20 units wide)
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 20 / maxDim;
        this.model.scale.setScalar(scale);

        // Re-center after scaling
        const scaledBox = new THREE.Box3().setFromObject(this.model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        this.model.position.sub(scaledCenter);
        this.model.position.y += scaledBox.getSize(new THREE.Vector3()).y / 2;

        this.scene.add(this.model);

        // Force update matrices to get accurate world coordinates
        this.model.updateMatrixWorld(true);

        // Flatten the back duplicate canopy, pillars, and details dynamically in world coordinates
        this.model.traverse((child) => {
          if (child.isMesh) {
            const geometry = child.geometry;
            const position = geometry.attributes.position;
            const tempV = new THREE.Vector3();

            for (let i = 0; i < position.count; i++) {
              tempV.fromBufferAttribute(position, i);
              child.localToWorld(tempV);

              // If vertex is below roof gutter (Y < 6.5) and protrudes at the back (Z < -6.0)
              if (tempV.y < 6.5 && tempV.z < -6.0) {
                tempV.z = -6.0; // Flatten to the Z = -6.0 plane
                child.worldToLocal(tempV);
                position.setXYZ(i, tempV.x, tempV.y, tempV.z);
              }
            }
            position.needsUpdate = true;
            geometry.computeVertexNormals();
          }
        });

        // Add a super thin plaster wall (0.05 units thick) over the flattened back to hide old textures
        const wallW = scaledBox.getSize(new THREE.Vector3()).x * 0.94; // fits perfectly to side walls
        const wallH = 6.4; // height to reach and touch the underside of the roof eave (up to Y=6.5)
        const wallD = 0.05; // thin flat wall
        const coverWallGeo = new THREE.BoxGeometry(wallW, wallH, wallD);
        const coverWallMat = new THREE.MeshStandardMaterial({
          color: 0xE7D5BC, // Bright warm cream matching front facade color
          roughness: 0.9,
          metalness: 0.05
        });
        const coverWall = new THREE.Mesh(coverWallGeo, coverWallMat);
        // Positioned at Z = -6.03 (just behind the flattened Z = -6.0 plane)
        coverWall.position.set(0, wallH / 2 + 0.1, -6.03);
        coverWall.castShadow = true;
        coverWall.receiveShadow = true;
        this.scene.add(coverWall);

        // Update controls target to model center
        this.controls.target.set(0, scaledBox.getSize(new THREE.Vector3()).y / 2, 0);
        this.controls.update();

        console.log('GLB model loaded successfully');
      },
      (progress) => {
        const pct = (progress.loaded / progress.total * 100).toFixed(0);
        console.log('Loading model: ' + pct + '%');
      },
      (error) => {
        console.error('Error loading GLB model:', error);
        // Fallback: build procedural model if GLB fails
        this.buildFallback();
      }
    );
  },

  // Simple fallback if GLB fails to load
  buildFallback() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xE8D5A8, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 5.5, 9), mat);
    body.position.set(0, 3.4, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);
  },

  // ============ HOTSPOTS ============
  createHotspots() {
    if (typeof MAP_DATA === 'undefined' || !MAP_DATA.areas || MAP_DATA.areas.length === 0) return;

    const hotspotPositions = {
      'mat-tien-tru-cot':   { x: 0, y: 3.5, z: 7 },
      'thap-canh-dong-ho':  { x: 0, y: 12, z: 2 },
      'tranh-tuong-canh':   { x: 7, y: 4, z: 5 },
      'mai-ngoi-do':        { x: -6, y: 8, z: 0 },
      'be-da-tham-co':      { x: 10, y: 0.8, z: 5 },
    };

    this.hotspots.forEach(h => {
      this.scene.remove(h.marker);
      this.scene.remove(h.pin);
      this.scene.remove(h.ring);
    });
    this.hotspots = [];

    MAP_DATA.areas.forEach((area, idx) => {
      const pos = hotspotPositions[area.id];
      if (!pos) return;

      const markerGeo = new THREE.SphereGeometry(0.8, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(pos.x, pos.y, pos.z);
      marker.userData = { areaId: area.id, areaIndex: idx, isHotspot: true };
      this.scene.add(marker);

      const pinGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const pinMat = new THREE.MeshStandardMaterial({
        color: area.color || 0xC9A84C,
        emissive: area.color || 0xC9A84C,
        emissiveIntensity: 0.45,
        metalness: 0.3,
        roughness: 0.4,
      });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(pos.x, pos.y, pos.z);
      this.scene.add(pin);

      const ringGeo = new THREE.RingGeometry(0.45, 0.65, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: area.color || 0xC9A84C,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, pos.y, pos.z);
      ring.lookAt(this.camera.position);
      this.scene.add(ring);

      this.hotspots.push({
        marker, pin, ring, area, idx,
        pos: new THREE.Vector3(pos.x, pos.y, pos.z)
      });
    });
  },

  // ============ EVENTS ============
  onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hotspotMeshes = this.hotspots.map(h => h.marker);
    const intersects = this.raycaster.intersectObjects(hotspotMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const area = MAP_DATA.areas[hit.userData.areaIndex];
      if (area && typeof window.openHotspotModal === 'function') {
        window.openHotspotModal(area);
      }
    }
  },

  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hotspotMeshes = this.hotspots.map(h => h.marker);
    const intersects = this.raycaster.intersectObjects(hotspotMeshes);
    this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
  },

  onResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  // ============ RENDER LOOP ============
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const time = Date.now() * 0.001;

    if (this.controls) this.controls.update();

    this.hotspots.forEach((h, i) => {
      h.ring.lookAt(this.camera.position);
      const scale = 1 + 0.25 * Math.sin(time * 2.2 + i * 0.7);
      h.ring.scale.set(scale, scale, scale);
      h.ring.material.opacity = 0.2 + 0.2 * Math.sin(time * 2.2 + i * 0.7);
      h.pin.position.y = h.pos.y + 0.12 * Math.sin(time * 1.6 + i * 0.4);
    });

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Temple3D.init('temple-3d-container');

  document.addEventListener('hotspots-updated', () => {
    Temple3D.createHotspots();
  });
});
export default Temple3D;
