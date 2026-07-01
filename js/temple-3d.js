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

  // Colors designed to match the provided photos
  COLORS: {
    whiteWall:     0xF9F6EF, // Cream white
    roofRed:       0xC13F2E, // Terracotta red
    columnTerracotta: 0x9B4E3C, // Terracotta pillars
    shutterBrown:  0x5A3C28, // Dark brown wood
    signBlue:      0x1E3B5C, // Dark blue sign board
    textGold:      0xDCB35C, // Gold text color
    groundStone:   0xBAB0A2, // Grey stone base
    grassGreen:    0x4E723D, // Grass lawn
    spireGrey:     0xE2DFD8, // Light grey spire
    spireTrim:     0x6E4C38, // Trim brown for spire edges
    clockBlack:    0x252528, // Black clock face
    windowGlass:   0x222225, // Glass color
    skyColor:      0xE8F2F7,
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
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

    // Camera - set to view the front-left/isometric angle like photo 2
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 500);
    this.camera.position.set(38, 22, 38);
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
    this.controls.minDistance = 15;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 4, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.3;

    // Lighting
    this.addLighting();

    // Build the Palace
    this.buildPalace();

    // Create hotspot markers
    this.createHotspots();

    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Control buttons
    document.getElementById('model-zoom-in')?.addEventListener('click', () => {
      this.camera.position.multiplyScalar(0.85);
      this.controls.update();
    });
    document.getElementById('model-zoom-out')?.addEventListener('click', () => {
      this.camera.position.multiplyScalar(1.15);
      this.controls.update();
    });
    document.getElementById('model-reset')?.addEventListener('click', () => {
      this.camera.position.set(38, 22, 38);
      this.controls.target.set(0, 4, 0);
      this.controls.update();
    });

    this.isInitialized = true;

    // Start animation
    this.animate();
  },

  addLighting() {
    // Ambient light - warm base
    const ambient = new THREE.AmbientLight(0xFFF3E0, 0.65);
    this.scene.add(ambient);

    // Sun directional light
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.4);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // Sky/Fill light - blue reflection
    const skyLight = new THREE.HemisphereLight(0xCCE0FF, 0x8D7E6F, 0.4);
    this.scene.add(skyLight);

    // Back light to separate model from background
    const backLight = new THREE.DirectionalLight(0xFFDDA0, 0.5);
    backLight.position.set(-30, 20, -20);
    this.scene.add(backLight);
  },

  // ============ MATERIAL HELPER ============
  mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.6,
      metalness: opts.metalness ?? 0.05,
      ...opts
    });
  },

  // ============ BASIC GEOMETRY CREATORS ============
  createBox(w, h, d, color, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, this.mat(color, opts));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  createCylinder(rTop, rBot, h, color, x, y, z, segments = 16) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segments);
    const mesh = new THREE.Mesh(geo, this.mat(color, { roughness: 0.5 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  // ============ PROCEDURAL PALACE GENERATOR ============
  buildPalace() {
    const C = this.COLORS;

    // 1. BASE AND STONE PLATFORM (Bệ đá & Thảm cỏ)
    // Large ground floor plane
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = this.mat(0x1a1a2e, { roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Stone retaining wall base (like Photo 4)
    // Sized to fit the building (which is 24 x 10)
    const baseW = 26;
    const baseD = 12;
    const baseH = 0.6;
    const base = this.createBox(baseW, baseH, baseD, C.groundStone, 0, baseH / 2, 0);
    this.scene.add(base);

    // Green grass band wrap around the stone base
    const grass = this.createBox(baseW + 0.3, 0.12, baseD + 0.3, C.grassGreen, 0, baseH + 0.06, 0);
    this.scene.add(grass);

    // Inner concrete walkway
    const walkway = this.createBox(baseW - 0.2, 0.1, baseD - 0.2, 0xD0C8B8, 0, baseH + 0.1, 0);
    this.scene.add(walkway);


    // 2. MAIN BUILDING BODY (Tòa nhà chính)
    // Symmetrical structure: width=22, depth=8, height=6.5
    const bW = 22;
    const bD = 8;
    const bH = 6.2;
    const bY = baseH + 0.1 + bH / 2; // Position on top of walkway
    const mainBody = this.createBox(bW, bH, bD, C.whiteWall, 0, bY, 0, { roughness: 0.7 });
    this.scene.add(mainBody);


    // 3. FRONT PORTICO / ENTRANCE (Mái hiên và Cột trụ)
    // Sits in the center front: width=8.5, depth=1.8, height=5.5
    const pW = 8.5;
    const pD = 1.8;
    const pH = 5.2;
    const pZ = bD/2 + pD/2; // Projected forward
    const porticoY = baseH + 0.1 + pH / 2;

    // Recessed entrance alcove (behind the columns)
    const alcove = this.createBox(pW - 0.4, pH, pD, C.whiteWall, 0, porticoY, pZ - 0.2);
    this.scene.add(alcove);

    // Flat white canopy top over columns
    const canopyH = 0.35;
    const canopy = this.createBox(pW + 0.4, canopyH, pD + 0.4, C.whiteWall, 0, baseH + 0.1 + pH + canopyH/2, pZ);
    this.scene.add(canopy);

    // 4 terracotta-colored pillars (4 cột trụ tròn lớn)
    const colR = 0.16;
    const colH = pH - 0.1;
    const colY = baseH + 0.1 + colH/2;
    const colZ = pZ + pD/2 - 0.2;
    const colXSpacing = pW / 3.2; // Spacing for 4 columns

    for (let i = -1.5; i <= 1.5; i += 1) {
      const cx = i * colXSpacing;
      // Circular column shaft
      const col = this.createCylinder(colR, colR * 1.1, colH, C.columnTerracotta, cx, colY, colZ, 12);
      this.scene.add(col);
      // Column base collar (Stone gray square)
      const baseCollar = this.createBox(colR*2.8, 0.15, colR*2.8, C.groundStone, cx, baseH + 0.1 + 0.075, colZ);
      this.scene.add(baseCollar);
      // Column top collar
      const topCollar = this.createBox(colR*2.6, 0.1, colR*2.6, C.whiteWall, cx, baseH + 0.1 + colH - 0.05, colZ);
      this.scene.add(topCollar);
    }

    // Entrance doors (Behind pillars, inside alcove)
    const doorW = 1.4;
    const doorH = 2.4;
    const doorZ = pZ - 0.2 + pD/2 - 0.01;
    // Central double door
    this.scene.add(this.createBox(doorW, doorH, 0.1, C.shutterBrown, 0, baseH + 0.1 + doorH/2, doorZ));
    // Side doors/windows under portico
    this.scene.add(this.createBox(0.9, 2.0, 0.1, C.shutterBrown, -pW/3.2, baseH + 0.1 + 1.0, doorZ));
    this.scene.add(this.createBox(0.9, 2.0, 0.1, C.shutterBrown, pW/3.2, baseH + 0.1 + 1.0, doorZ));


    // 4. SIGN BOARD (Biển hiệu Dinh Tỉnh Trưởng)
    // Dark blue sign with gold border details above columns
    const signW = 3.6;
    const signH = 0.55;
    const signZ = colZ + 0.11;
    const signY = baseH + 0.1 + pH - signH/2 - 0.2;
    
    const signBoard = this.createBox(signW, signH, 0.08, C.signBlue, 0, signY, signZ);
    this.scene.add(signBoard);

    // Gold inner text strip simulation
    const signText = this.createBox(signW - 0.2, signH - 0.15, 0.02, C.textGold, 0, signY, signZ + 0.05);
    this.scene.add(signText);


    // 5. SYMMETRICAL FACADE DETAILS (Chi tiết mặt tiền hai bên)
    // Symmetrical wings - Left & Right murals (tranh tường) and shutters
    const wingX = 7.0; // Distance of wings from center
    const muralW = 3.2;
    const muralH = 1.5;
    const muralY = bY - 0.4;
    const muralZ = bD/2 + 0.06;

    // Create left mural (Warm tones - red/brown theme)
    const leftMural = this.createBox(muralW, muralH, 0.05, 0x8A453B, -wingX, muralY, muralZ);
    this.scene.add(leftMural);
    // Left mural white border frame
    const leftFrame = this.createBox(muralW + 0.3, muralH + 0.3, 0.03, C.whiteWall, -wingX, muralY, muralZ - 0.02);
    this.scene.add(leftFrame);

    // Create right mural (Cool tones - blue/green theme)
    const rightMural = this.createBox(muralW, muralH, 0.05, 0x3F6A75, wingX, muralY, muralZ);
    this.scene.add(rightMural);
    // Right mural white border frame
    const rightFrame = this.createBox(muralW + 0.3, muralH + 0.3, 0.03, C.whiteWall, wingX, muralY, muralZ - 0.02);
    this.scene.add(rightFrame);

    // Facade windows with dark wood shutters (Cửa sổ lá sách)
    // 2 windows on ground floor (below murals)
    const winGW = 0.9;
    const winGH = 1.3;
    const winGY = baseH + 0.1 + winGH/2 + 0.3;
    this.scene.add(this.createBox(winGW, winGH, 0.05, C.shutterBrown, -wingX, winGY, muralZ));
    this.scene.add(this.createBox(winGW, winGH, 0.05, C.shutterBrown, wingX, winGY, muralZ));

    // 2 windows on upper floor (next to central tower)
    const winUY = bY + bH/2 - 1.2;
    const winUX = 4.2;
    this.scene.add(this.createBox(0.9, 1.4, 0.05, C.shutterBrown, -winUX, winUY, muralZ));
    this.scene.add(this.createBox(0.9, 1.4, 0.05, C.shutterBrown, winUX, winUY, muralZ));

    // Side windows (small slots on side walls)
    const sideX = bW/2 + 0.02;
    const sideZOffset = 2.0;
    // Left side slots
    this.scene.add(this.createBox(0.04, 1.2, 0.4, C.shutterBrown, -sideX, bY - 0.5, sideZOffset));
    this.scene.add(this.createBox(0.04, 1.2, 0.4, C.shutterBrown, -sideX, bY - 0.5, -sideZOffset));
    // Right side slots
    this.scene.add(this.createBox(0.04, 1.2, 0.4, C.shutterBrown, sideX, bY - 0.5, sideZOffset));
    this.scene.add(this.createBox(0.04, 1.2, 0.4, C.shutterBrown, sideX, bY - 0.5, -sideZOffset));


    // 6. MAIN HIP ROOF (Mái ngói đỏ chóp xiên)
    // Terracotta-red hip roof slanted on all sides
    // Constructed via an extrusion or sloped segments to look exact
    const rW = bW + 1.2;
    const rD = bD + 1.2;
    const rH = 2.4;
    const rY = baseH + 0.1 + bH; // Base height of roof

    const roofGroup = new THREE.Group();
    roofGroup.position.set(0, rY, 0);

    // Left main slope
    const leftSlopeGeo = new THREE.BoxGeometry(rW / 2 + 0.2, 0.15, rD);
    const leftSlope = new THREE.Mesh(leftSlopeGeo, this.mat(C.roofRed, { roughness: 0.75 }));
    leftSlope.position.set(-rW / 4, rH / 2, 0);
    leftSlope.rotation.z = Math.atan2(rH, rW / 2);
    leftSlope.castShadow = true;
    leftSlope.receiveShadow = true;
    roofGroup.add(leftSlope);

    // Right main slope
    const rightSlope = new THREE.Mesh(leftSlopeGeo, this.mat(C.roofRed, { roughness: 0.75 }));
    rightSlope.position.set(rW / 4, rH / 2, 0);
    rightSlope.rotation.z = -Math.atan2(rH, rW / 2);
    rightSlope.castShadow = true;
    rightSlope.receiveShadow = true;
    roofGroup.add(rightSlope);

    // Front/Back triangular slopes (hip closures)
    const hipSlopeGeo = new THREE.BoxGeometry(rW, 0.15, rD / 2 + 0.2);
    // Front slope
    const frontSlope = new THREE.Mesh(hipSlopeGeo, this.mat(C.roofRed, { roughness: 0.75 }));
    frontSlope.position.set(0, rH / 2, rD / 4);
    frontSlope.rotation.x = -Math.atan2(rH, rD / 2);
    frontSlope.castShadow = true;
    frontSlope.receiveShadow = true;
    roofGroup.add(frontSlope);

    // Back slope
    const backSlope = new THREE.Mesh(hipSlopeGeo, this.mat(C.roofRed, { roughness: 0.75 }));
    backSlope.position.set(0, rH / 2, -rD / 4);
    backSlope.rotation.x = Math.atan2(rH, rD / 2);
    backSlope.castShadow = true;
    backSlope.receiveShadow = true;
    roofGroup.add(backSlope);

    // White trim overhang base board
    const trimBase = this.createBox(rW - 0.2, 0.2, rD - 0.2, C.whiteWall, 0, 0.05, 0);
    roofGroup.add(trimBase);

    this.scene.add(roofGroup);


    // 7. CENTRAL WATCH TOWER & CLOCK (Tháp canh trung tâm)
    // Sits right in the center of the roof ridge
    const tW = 3.6;
    const tD = 3.6;
    const tH = 6.2;
    const tY = rY + rH - 0.3 + tH / 2; // Rises above roof ridge

    // Tower base walls
    const tower = this.createBox(tW, tH, tD, C.whiteWall, 0, tY, 0, { roughness: 0.65 });
    this.scene.add(tower);

    // Circular clock face (Đồng hồ phía trước)
    const clockR = 0.55;
    const clockZ = tD/2 + 0.06;
    const clockY = tY - tH/2 + 1.3;
    const clock = this.createCylinder(clockR, clockR, 0.08, C.clockBlack, 0, clockY, clockZ, 24);
    clock.rotation.x = Math.PI / 2;
    this.scene.add(clock);

    // Clock center detail (white dot/hands simulation)
    const clockPin = this.createCylinder(0.08, 0.08, 0.1, 0xFFFFFF, 0, clockY, clockZ + 0.02, 8);
    clockPin.rotation.x = Math.PI / 2;
    this.scene.add(clockPin);

    // 3 vertical louver slits above the clock
    const louverW = 0.18;
    const louverH = 0.9;
    const louverY = clockY + 1.6;
    const louverZ = tD/2 + 0.05;
    const louverSpacing = 0.35;
    for (let i = -1; i <= 1; i++) {
      const lx = i * louverSpacing;
      const slit = this.createBox(louverW, louverH, 0.06, C.shutterBrown, lx, louverY, louverZ);
      this.scene.add(slit);
    }

    // Side windows on the tower (Left and Right faces)
    const tWinY = tY + 0.8;
    const tWinW = 0.8;
    const tWinH = 1.8;
    // Left side window
    const tWinL = this.createBox(0.06, tWinH, tWinW, C.shutterBrown, -tW/2 - 0.02, tWinY, 0);
    this.scene.add(tWinL);
    // Right side window
    const tWinR = this.createBox(0.06, tWinH, tWinW, C.shutterBrown, tW/2 + 0.02, tWinY, 0);
    this.scene.add(tWinR);


    // 8. TOWER SPIRE / ROOF (Chóp nhọn tháp canh)
    // Pyramid spire roof, grey/white with dark brown trim edges
    const sH = 3.6; // Height of the pyramid spire
    const sY = tY + tH/2; // Base of the spire
    const spireGroup = new THREE.Group();
    spireGroup.position.set(0, sY, 0);

    // White trim collar below spire
    const spireCollar = this.createBox(tW + 0.4, 0.35, tD + 0.4, C.whiteWall, 0, 0.15, 0);
    spireGroup.add(spireCollar);

    // Pyramidal structure
    const pyrGeo = new THREE.ConeGeometry((tW + 0.2) * 0.707, sH, 4);
    const pyr = new THREE.Mesh(pyrGeo, this.mat(C.spireGrey, { roughness: 0.8 }));
    pyr.position.y = 0.35 + sH / 2;
    pyr.rotation.y = Math.PI / 4; // Align 4 corners of cone to square faces
    pyr.castShadow = true;
    pyr.receiveShadow = true;
    spireGroup.add(pyr);

    // Trim lines on the 4 corners of the spire (like Photo 3)
    const trimW = 0.08;
    const trimL = Math.sqrt(Math.pow(tW/2, 2) + Math.pow(sH, 2)) + 0.2;
    const angle = Math.atan2(tW/2, sH);

    for (let i = 0; i < 4; i++) {
      const angleRad = (i * Math.PI) / 2 + Math.PI / 4;
      const tx = Math.cos(angleRad) * (tW / 4);
      const tz = Math.sin(angleRad) * (tW / 4);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(trimW, trimL, trimW),
        this.mat(C.spireTrim, { roughness: 0.5 })
      );
      trim.position.set(tx, 0.35 + sH / 2, tz);
      trim.rotation.y = -angleRad;
      // Slanted rotation matching the slope
      if (i === 0) trim.rotation.z = angle;
      if (i === 1) trim.rotation.x = -angle;
      if (i === 2) trim.rotation.z = -angle;
      if (i === 3) trim.rotation.x = angle;

      spireGroup.add(trim);
    }

    // Top metal spire point
    const point = this.createCylinder(0.02, 0.05, 0.7, 0x909090, 0, 0.35 + sH + 0.35, 0, 8);
    spireGroup.add(point);

    this.scene.add(spireGroup);
  },

  // ============ HOTSPOTS ============
  createHotspots() {
    if (typeof MAP_DATA === 'undefined' || !MAP_DATA.areas || MAP_DATA.areas.length === 0) return;

    // Hotspots will anchor to specific components on the 3D palace
    const hotspotPositions = {
      'mat-tien-tru-cot':   { x: 0, y: 3.5, z: 6.2 },
      'thap-canh-dong-ho':  { x: 0, y: 11.5, z: 2.2 },
      'tranh-tuong-canh':   { x: 7.0, y: 3.5, z: 4.2 },
      'mai-ngoi-do':        { x: -7.0, y: 7.2, z: 0 },
      'be-da-tham-co':      { x: 12.0, y: 0.8, z: 5.0 },
    };

    // Clean old hotspots
    this.hotspots.forEach(h => {
      this.scene.remove(h.marker);
      this.scene.remove(h.pin);
      this.scene.remove(h.ring);
    });
    this.hotspots = [];

    // Create 3D marker meshes
    MAP_DATA.areas.forEach((area, idx) => {
      const pos = hotspotPositions[area.id];
      if (!pos) return;

      // Marker sphere (invisible, for raycasting)
      const markerGeo = new THREE.SphereGeometry(0.8, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({ 
        transparent: true, opacity: 0, depthTest: false 
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(pos.x, pos.y, pos.z);
      marker.userData = { areaId: area.id, areaIndex: idx, isHotspot: true };
      this.scene.add(marker);

      // Visible pin
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

      // Outer ring (pulsing glow)
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

  // ============ INTERACTION & EVENT HANDLERS ============
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

    // Controls update
    if (this.controls) this.controls.update();

    // Pulse & Float hotspots
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

// Global entrypoint for application
document.addEventListener('DOMContentLoaded', () => {
  Temple3D.init('temple-3d-container');
  
  // Listen to hotspot additions later
  document.addEventListener('hotspots-updated', () => {
    Temple3D.createHotspots();
  });
});
export default Temple3D;
