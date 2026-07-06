import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

  // Colors matched precisely to the physical scale model photos
  COLORS: {
    cream:        0xE8D5A8,  // Colonial cream/pale yellow walls
    roofTerra:    0x8B4531,  // Brownish-terracotta roof tiles
    roofRidge:    0x6B3522,  // Darker ridge lines on roof
    pilaster:     0x7A3325,  // Deep red-brown pilasters/columns
    shutterBrown: 0x4A2E1A,  // Dark brown wood shutters/louvers
    signBlue:     0x1E3B5C,  // Dark blue sign board
    textGold:     0xDCB35C,  // Gold text
    stone:        0xB5AA98,  // Grey stone base
    grass:        0x4E723D,  // Green grass/bushes
    spire:        0xE5D5B8,  // Light cream spire
    spireTrim:    0x8B4531,  // Terracotta trim on spire
    clockBlack:   0x1A1A1A,  // Black clock face
    windowDark:   0x2A2018,  // Very dark window glass
    white:        0xF0E8D8,  // Off-white trim
  },

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.overlayContainer = document.getElementById('hotspot-overlay');

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.006);

    // Camera
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 500);
    this.camera.position.set(32, 20, 32);
    this.camera.lookAt(0, 5, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 70;
    this.controls.target.set(0, 5, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.3;

    // Lighting
    this.addLighting();

    // Build
    this.buildPalace();

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
      this.camera.position.set(32, 20, 32);
      this.controls.target.set(0, 5, 0);
      this.controls.update();
    });

    this.isInitialized = true;
    this.animate();
  },

  addLighting() {
    const ambient = new THREE.AmbientLight(0xFFF3E0, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.3);
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

    const skyLight = new THREE.HemisphereLight(0xCCE0FF, 0x8D7E6F, 0.35);
    this.scene.add(skyLight);

    const backLight = new THREE.DirectionalLight(0xFFDDA0, 0.4);
    backLight.position.set(-25, 18, -18);
    this.scene.add(backLight);
  },

  // ============ MATERIAL ============
  mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.6,
      metalness: opts.metalness ?? 0.05,
      ...opts
    });
  },

  // ============ GEOMETRY HELPERS ============
  box(w, h, d, color, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, this.mat(color, opts));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  cyl(rT, rB, h, color, x, y, z, seg = 16) {
    const geo = new THREE.CylinderGeometry(rT, rB, h, seg);
    const mesh = new THREE.Mesh(geo, this.mat(color, { roughness: 0.5 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  // Unified hip roof mesh (no overlapping corners)
  hipRoof(w, h, d, color, x, y, z) {
    // Ridge runs along X axis. If w > d, ridge is longer. If w < d, ridge along Z.
    const ridgeHalf = Math.max(0, (w - d) / 2);

    const verts = new Float32Array([
      // Front face (+Z) - trapezoid split into 2 triangles
      -w/2, 0,  d/2,    w/2, 0,  d/2,    ridgeHalf, h, 0,
      -w/2, 0,  d/2,    ridgeHalf, h, 0,  -ridgeHalf, h, 0,
      // Back face (-Z)
       w/2, 0, -d/2,   -w/2, 0, -d/2,   -ridgeHalf, h, 0,
       w/2, 0, -d/2,   -ridgeHalf, h, 0,  ridgeHalf, h, 0,
      // Left face (-X) - triangle
      -w/2, 0, -d/2,   -w/2, 0,  d/2,   -ridgeHalf, h, 0,
      // Right face (+X) - triangle
       w/2, 0,  d/2,    w/2, 0, -d/2,    ridgeHalf, h, 0,
      // Bottom face (close the volume)
      -w/2, 0, -d/2,    w/2, 0, -d/2,    w/2, 0,  d/2,
      -w/2, 0, -d/2,    w/2, 0,  d/2,   -w/2, 0,  d/2,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.mat(color, { roughness: 0.72, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  // Pyramid roof (4-sided cone aligned to square)
  pyramid(size, h, color, x, y, z) {
    const geo = new THREE.ConeGeometry(size * 0.707, h, 4);
    const mesh = new THREE.Mesh(geo, this.mat(color, { roughness: 0.7 }));
    mesh.position.set(x, y + h/2, z);
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  // Recessed window (frame + recessed pane)
  recessedWin(w, h, color, x, y, z, axis = 'Z') {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const C = this.COLORS;

    if (axis === 'X') {
      g.add(this.box(0.12, h + 0.12, w + 0.12, C.white, 0, 0, 0));
      g.add(this.box(0.06, h, w, color, -0.05, 0, 0));
    } else {
      g.add(this.box(w + 0.12, h + 0.12, 0.12, C.white, 0, 0, 0));
      g.add(this.box(w, h, 0.06, color, 0, 0, -0.05));
    }
    return g;
  },

  // ============ BUILD THE PALACE ============
  buildPalace() {
    const C = this.COLORS;

    // ---- GROUND ----
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floor = new THREE.Mesh(floorGeo, this.mat(0x1a1a2e, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // ---- STONE BASE PLATFORM ----
    const baseW = 24;
    const baseD = 13;
    const baseH = 0.55;
    this.scene.add(this.box(baseW, baseH, baseD, C.stone, 0, baseH/2, 0));

    // Green grass trim around base
    this.scene.add(this.box(baseW + 0.4, 0.08, baseD + 0.4, C.grass, 0, baseH + 0.04, 0));

    // Inner walkway
    this.scene.add(this.box(baseW - 0.3, 0.06, baseD - 0.3, 0xD2CAB8, 0, baseH + 0.08, 0));

    // Small green bushes at front corners
    const bushY = baseH / 2;
    [-baseW/2 + 1, baseW/2 - 1].forEach(bx => {
      this.scene.add(this.box(1.5, 0.7, 0.8, 0x3D6B30, bx, bushY + 0.35, baseD/2 - 0.1, { roughness: 0.9 }));
    });

    const topBase = baseH + 0.1; // Y where building starts

    // ---- MAIN BUILDING BODY ----
    // From photos: wider than deep, single story with tall walls
    const bW = 20;   // width (X)
    const bD = 9;    // depth (Z)
    const bH = 5.5;  // height
    const bY = topBase + bH / 2;

    this.scene.add(this.box(bW, bH, bD, C.cream, 0, bY, 0, { roughness: 0.72 }));

    // White horizontal cornice band at top of walls (visible in all photos)
    this.scene.add(this.box(bW + 0.3, 0.25, bD + 0.3, C.white, 0, topBase + bH, 0));
    // White base band
    this.scene.add(this.box(bW + 0.15, 0.2, bD + 0.15, C.white, 0, topBase + 0.1, 0));

    // ---- FRONT PORTICO (Sảnh cột trước) ----
    // Central entrance area that protrudes forward with columns
    const pW = 7.5;   // portico width
    const pD = 1.6;   // portico depth (how far it sticks out)
    const pH = 5.0;   // portico height
    const pZ = bD/2 + pD/2;

    // Portico back wall (alcove behind columns)
    this.scene.add(this.box(pW - 0.3, pH, pD - 0.2, C.cream, 0, topBase + pH/2, pZ - 0.3));

    // Flat canopy/entablature on top of columns
    this.scene.add(this.box(pW + 0.5, 0.3, pD + 0.5, C.white, 0, topBase + pH, pZ));

    // 6 columns (matching front photo - ~6 visible columns)
    const colCount = 6;
    const colSpacing = (pW - 0.8) / (colCount - 1);
    const colR = 0.18;
    const colH = pH - 0.4;
    const colZ = pZ + pD/2 - 0.15;

    for (let i = 0; i < colCount; i++) {
      const cx = -(pW - 0.8)/2 + i * colSpacing;
      // Column shaft
      this.scene.add(this.cyl(colR, colR * 1.1, colH, C.pilaster, cx, topBase + colH/2 + 0.1, colZ, 12));
      // Column base
      this.scene.add(this.box(colR * 3, 0.12, colR * 3, C.stone, cx, topBase + 0.06, colZ));
      // Column capital
      this.scene.add(this.box(colR * 2.8, 0.1, colR * 2.8, C.white, cx, topBase + colH + 0.05, colZ));
    }

    // Entrance doors (behind columns)
    const doorZ = pZ + pD/2 - 0.02;
    // Central double door
    this.scene.add(this.box(1.3, 2.3, 0.08, C.shutterBrown, 0, topBase + 1.15, doorZ));
    // Side doors
    this.scene.add(this.box(0.8, 1.8, 0.08, C.shutterBrown, -2.2, topBase + 0.9, doorZ));
    this.scene.add(this.box(0.8, 1.8, 0.08, C.shutterBrown,  2.2, topBase + 0.9, doorZ));

    // ---- SIGN BOARD (Bien hieu) ----
    const signY = topBase + pH - 0.4;
    this.scene.add(this.box(3.2, 0.5, 0.06, C.signBlue, 0, signY, colZ + 0.1));
    this.scene.add(this.box(2.9, 0.3, 0.02, C.textGold, 0, signY, colZ + 0.14));

    // ---- FACADE PILASTERS (Tru bo tuong) ----
    // Vertical red-brown strips on the facade, as seen in front photo
    const pilH = bH;
    const pilW = 0.22;
    const pilD = 0.12;
    const pilZ = bD/2 + pilD/2;
    const pilY = topBase + pilH/2;

    // Inner pilasters flanking portico
    [-pW/2 - 0.3, pW/2 + 0.3].forEach(px => {
      this.scene.add(this.box(pilW, pilH, pilD, C.pilaster, px, pilY, pilZ));
    });

    // Wing pilasters (2 on each wing, visible in front photo)
    const wingPilasters = [-8.2, -6.0, 6.0, 8.2];
    wingPilasters.forEach(px => {
      this.scene.add(this.box(pilW, pilH, pilD, C.pilaster, px, pilY, pilZ));
    });

    // Corner pilasters on front corners
    [-bW/2 + 0.12, bW/2 - 0.12].forEach(px => {
      this.scene.add(this.box(pilW, pilH, pilD, C.pilaster, px, pilY, pilZ));
    });

    // ---- FRONT FACADE WINDOWS ----
    // Ground floor windows on wings (2 per wing, 4 total)
    const winW = 0.85;
    const winH = 1.2;
    const gndWinY = topBase + winH/2 + 0.4;
    const facadeZ = bD/2 + 0.06;

    // Left wing windows
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown, -7.1, gndWinY, facadeZ, 'Z'));
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown, -9.0, gndWinY, facadeZ, 'Z'));
    // Right wing windows
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown,  7.1, gndWinY, facadeZ, 'Z'));
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown,  9.0, gndWinY, facadeZ, 'Z'));

    // Upper floor windows on wings
    const upWinY = topBase + bH - winH/2 - 0.5;
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown, -7.1, upWinY, facadeZ, 'Z'));
    this.scene.add(this.recessedWin(winW, winH, C.shutterBrown,  7.1, upWinY, facadeZ, 'Z'));

    // ---- TRANH TUONG (Murals) on wings ----
    // Left mural (warm tones)
    const muralW = 2.8;
    const muralH = 1.4;
    const muralY = topBase + bH/2 + 0.2;
    this.scene.add(this.box(muralW + 0.2, muralH + 0.2, 0.03, C.white, -7.1, muralY, facadeZ - 0.01));
    this.scene.add(this.box(muralW, muralH, 0.04, 0x8A453B, -7.1, muralY, facadeZ + 0.01));

    // Right mural (cool tones)
    this.scene.add(this.box(muralW + 0.2, muralH + 0.2, 0.03, C.white, 7.1, muralY, facadeZ - 0.01));
    this.scene.add(this.box(muralW, muralH, 0.04, 0x3F6A75, 7.1, muralY, facadeZ + 0.01));

    // ---- SIDE WALLS detail ----
    // Small recessed windows on side walls (visible in back/side photos)
    const sideX = bW/2 + 0.02;
    const sideWinY = topBase + bH/2;
    [-2.5, 0, 2.5].forEach(sz => {
      this.scene.add(this.recessedWin(0.5, 1.0, C.shutterBrown, -sideX, sideWinY, sz, 'X'));
      this.scene.add(this.recessedWin(0.5, 1.0, C.shutterBrown,  sideX, sideWinY, sz, 'X'));
    });

    // ---- MAIN HIP ROOF ----
    const roofOverhang = 1.0;
    const rW = bW + roofOverhang * 2;  // 22
    const rD = bD + roofOverhang * 2;  // 11
    const rH = 2.8;
    const rY = topBase + bH;

    const roofGroup = new THREE.Group();
    roofGroup.position.set(0, rY, 0);

    // Main solid hip roof
    roofGroup.add(this.hipRoof(rW, rH, rD, C.roofTerra, 0, 0, 0));

    // White fascia/trim board around the eaves
    roofGroup.add(this.box(rW + 0.1, 0.2, rD + 0.1, C.white, 0, 0.05, 0));

    this.scene.add(roofGroup);

    // ---- CENTRAL WATCHTOWER ----
    // Square tower rises from center of roof ridge
    const tW = 3.2;
    const tD = 3.2;
    const tH = 5.5;
    const tBase = rY + rH * 0.5; // starts partway up the roof
    const tY = tBase + tH / 2;

    // Tower walls
    this.scene.add(this.box(tW, tH, tD, C.cream, 0, tY, 0, { roughness: 0.68 }));

    // White trim band at top of tower
    this.scene.add(this.box(tW + 0.2, 0.2, tD + 0.2, C.white, 0, tBase + tH, 0));
    // White trim band at bottom of tower
    this.scene.add(this.box(tW + 0.15, 0.15, tD + 0.15, C.white, 0, tBase + 0.08, 0));

    // Tower front face details (facing +Z)
    const tFaceZ = tD/2 + 0.04;

    // Clock face (circular, black)
    const clockR = 0.5;
    const clockY = tBase + 1.2;
    const clock = this.cyl(clockR, clockR, 0.06, C.clockBlack, 0, clockY, tFaceZ, 24);
    clock.rotation.x = Math.PI / 2;
    this.scene.add(clock);
    // Clock center pin
    const pin = this.cyl(0.06, 0.06, 0.08, 0xDDDDDD, 0, clockY, tFaceZ + 0.02, 8);
    pin.rotation.x = Math.PI / 2;
    this.scene.add(pin);
    // Clock hour markers (simple white dots at 12, 3, 6, 9)
    [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(a => {
      const mx = Math.sin(a) * (clockR - 0.1);
      const my = Math.cos(a) * (clockR - 0.1);
      const dot = this.cyl(0.03, 0.03, 0.07, 0xFFFFFF, mx, clockY + my, tFaceZ + 0.02, 6);
      dot.rotation.x = Math.PI / 2;
      this.scene.add(dot);
    });

    // Vertical louver slits above clock (3 slits, as in photo)
    const louverY = clockY + 1.5;
    const louverH = 1.0;
    const louverSpacing = 0.35;
    for (let i = -1; i <= 1; i++) {
      this.scene.add(this.box(0.15, louverH, 0.05, C.shutterBrown, i * louverSpacing, louverY, tFaceZ));
    }
    // Louver frame
    this.scene.add(this.box(1.4, louverH + 0.15, 0.03, C.white, 0, louverY, tFaceZ - 0.02));

    // Upper window on tower front (above louvers)
    const twinY = louverY + 1.4;
    this.scene.add(this.box(0.8, 0.7, 0.05, C.shutterBrown, 0, twinY, tFaceZ));
    this.scene.add(this.box(0.9, 0.8, 0.03, C.white, 0, twinY, tFaceZ - 0.02));

    // Tower side windows (left and right faces)
    const tSideWinY = tBase + tH / 2 + 0.5;
    this.scene.add(this.recessedWin(0.7, 1.5, C.shutterBrown, -tW/2 - 0.02, tSideWinY, 0, 'X'));
    this.scene.add(this.recessedWin(0.7, 1.5, C.shutterBrown,  tW/2 + 0.02, tSideWinY, 0, 'X'));

    // Tower back - simple, clean (as in back photo)
    // No extra decoration needed, the cream box is already there

    // ---- TOWER SMALL HIP ROOF ----
    // Small hip roof on top of tower (visible in all photos - terracotta colored)
    const trW = tW + 0.6;
    const trD = tD + 0.6;
    const trH = 1.2;
    const trY = tBase + tH;

    const towerRoofGroup = new THREE.Group();
    towerRoofGroup.position.set(0, trY, 0);

    towerRoofGroup.add(this.hipRoof(trW, trH, trD, C.roofTerra, 0, 0, 0));

    // White collar/trim under tower roof
    towerRoofGroup.add(this.box(trW + 0.05, 0.12, trD + 0.05, C.white, 0, 0.03, 0));



    this.scene.add(towerRoofGroup);

    // ---- SPIRE (Chop nhon) ----
    // Pointed pyramid spire on top of tower roof (cream/beige colored)
    const spireBase = trY + trH;
    const spireH = 3.5;

    // Collar/trim between tower roof and spire
    this.scene.add(this.box(tW * 0.55, 0.25, tD * 0.55, C.white, 0, spireBase + 0.12, 0));

    // Pyramidal spire
    this.scene.add(this.pyramid(tW * 0.5, spireH, C.spire, 0, spireBase + 0.25, 0));

    // Trim edges on spire corners (4 lines)
    const spireCornerDist = tW * 0.25 * 0.5;
    const spireEdgeLen = Math.sqrt(spireH * spireH + spireCornerDist * spireCornerDist * 2) + 0.2;
    const spireEdgeAngle = Math.atan2(spireCornerDist, spireH);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const ex = Math.cos(a) * spireCornerDist * 0.5;
      const ez = Math.sin(a) * spireCornerDist * 0.5;
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, spireEdgeLen, 0.06),
        this.mat(C.spireTrim, { roughness: 0.5 })
      );
      edge.position.set(ex, spireBase + 0.25 + spireH/2, ez);
      edge.rotation.y = -a;
      if (i === 0) edge.rotation.z = spireEdgeAngle;
      if (i === 1) edge.rotation.x = -spireEdgeAngle;
      if (i === 2) edge.rotation.z = -spireEdgeAngle;
      if (i === 3) edge.rotation.x = spireEdgeAngle;
      edge.castShadow = true;
      this.scene.add(edge);
    }

    // Metal tip at very top
    this.scene.add(this.cyl(0.02, 0.04, 0.6, 0x888888, 0, spireBase + 0.25 + spireH + 0.3, 0, 6));
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
