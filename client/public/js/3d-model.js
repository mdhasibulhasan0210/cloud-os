// 3D Model - Unique Crystalline Dodecahedron with Holographic Effects
// MD.Hasibul Hasan Personal Cloud OS

let scene, camera, renderer, dodecahedron, orbitingIcons, dataCore, gridFloor, particles;
let mouse = { x: 0, y: 0 };
let isAnimating = true;

// Initialize 3D scene
function init3DModel() {
  const container = document.getElementById('hero-3d');
  if (!container) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 8;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Create main crystalline dodecahedron
  createDodecahedron();

  // Create pulsing data core
  createDataCore();

  // Create orbiting holographic icons
  createOrbitingIcons();

  // Create cyber grid floor
  createGridFloor();

  // Create particle system (digital rain)
  createParticles();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x10b981, 1, 50);
  pointLight1.position.set(5, 5, 5);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x06b6d4, 0.8, 50);
  pointLight2.position.set(-5, -5, 5);
  scene.add(pointLight2);

  // Mouse move parallax
  document.addEventListener('mousemove', onMouseMove);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Visibility change (pause when tab not visible)
  document.addEventListener('visibilitychange', () => {
    isAnimating = !document.hidden;
  });

  // Start animation
  animate();
}

// Create hollow crystalline dodecahedron
function createDodecahedron() {
  const geometry = new THREE.DodecahedronGeometry(2, 0);
  
  // Create edges for hollow effect
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x10b981,
    transparent: true,
    opacity: 0.8,
    linewidth: 2
  });
  
  const wireframe = new THREE.LineSegments(edges, lineMaterial);
  
  // Create glowing faces
  const faceMaterial = new THREE.MeshPhongMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    emissive: 0x10b981,
    emissiveIntensity: 0.3
  });
  
  const faces = new THREE.Mesh(geometry, faceMaterial);
  
  // Group them together
  dodecahedron = new THREE.Group();
  dodecahedron.add(wireframe);
  dodecahedron.add(faces);
  
  scene.add(dodecahedron);
}

// Create space fabric effect (wave mesh)
function createDataCore() {
  const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.4,
    wireframe: false,
    side: THREE.DoubleSide
  });
  
  dataCore = new THREE.Mesh(geometry, material);
  dataCore.rotation.x = Math.PI / 4;
  
  // Store original positions for wave animation
  const positions = geometry.attributes.position.array;
  dataCore.userData.originalPositions = new Float32Array(positions);
  
  dodecahedron.add(dataCore);
}

// Create orbiting holographic icons
function createOrbitingIcons() {
  orbitingIcons = new THREE.Group();
  
  const iconCount = window.innerWidth < 768 ? 6 : 12; // Fewer on mobile
  const iconGeometry = new THREE.PlaneGeometry(0.3, 0.3);
  
  for (let i = 0; i < iconCount; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0x10b981 : 0x06b6d4,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    const icon = new THREE.Mesh(iconGeometry, material);
    
    // Position in spiral
    const angle = (i / iconCount) * Math.PI * 2;
    const radius = 3 + Math.sin(i) * 0.5;
    const height = Math.sin(i * 0.5) * 2;
    
    icon.position.x = Math.cos(angle) * radius;
    icon.position.y = height;
    icon.position.z = Math.sin(angle) * radius;
    
    icon.userData = {
      angle: angle,
      radius: radius,
      speed: 0.001 + Math.random() * 0.002,
      heightOffset: height
    };
    
    orbitingIcons.add(icon);
  }
  
  scene.add(orbitingIcons);
}

// Create cyber grid floor
function createGridFloor() {
  const size = 20;
  const divisions = 20;
  
  const gridHelper = new THREE.GridHelper(size, divisions, 0x10b981, 0x10b981);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.2;
  gridHelper.position.y = -4;
  
  scene.add(gridHelper);
  gridFloor = gridHelper;
}

// Create particle system (digital rain)
function createParticles() {
  if (window.innerWidth < 768) return; // Skip on mobile for performance
  
  const particleCount = 100;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];
  
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 20 - 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    
    velocities.push(0.01 + Math.random() * 0.02);
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const material = new THREE.PointsMaterial({
    color: 0x10b981,
    size: 0.05,
    transparent: true,
    opacity: 0.6
  });
  
  particles = new THREE.Points(geometry, material);
  particles.userData.velocities = velocities;
  
  scene.add(particles);
}

// Mouse move handler
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Window resize handler
function onWindowResize() {
  const container = document.getElementById('hero-3d');
  if (!container) return;
  
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation loop
function animate() {
  if (!isAnimating) {
    requestAnimationFrame(animate);
    return;
  }
  
  requestAnimationFrame(animate);
  
  const time = Date.now() * 0.001;
  
  // Rotate dodecahedron
  if (dodecahedron) {
    dodecahedron.rotation.x += 0.002;
    dodecahedron.rotation.y += 0.003;
    
    // Parallax effect
    dodecahedron.rotation.x += mouse.y * 0.0005;
    dodecahedron.rotation.y += mouse.x * 0.0005;
  }
  
  // Animate space fabric (wave effect)
  if (dataCore) {
    const positions = dataCore.geometry.attributes.position.array;
    const originalPositions = dataCore.userData.originalPositions;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      
      // Create wave effect
      positions[i + 2] = originalPositions[i + 2] + 
        Math.sin(x * 2 + time) * 0.1 + 
        Math.cos(y * 2 + time * 0.5) * 0.1;
    }
    
    dataCore.geometry.attributes.position.needsUpdate = true;
    dataCore.rotation.z += 0.001;
  }
  
  // Animate orbiting icons
  if (orbitingIcons) {
    orbitingIcons.children.forEach((icon, index) => {
      icon.userData.angle += icon.userData.speed;
      
      icon.position.x = Math.cos(icon.userData.angle) * icon.userData.radius;
      icon.position.z = Math.sin(icon.userData.angle) * icon.userData.radius;
      icon.position.y = icon.userData.heightOffset + Math.sin(time + index) * 0.3;
      
      // Face camera
      icon.lookAt(camera.position);
      
      // Pulse opacity
      icon.material.opacity = 0.4 + Math.sin(time * 2 + index) * 0.2;
      
      // Accelerate on hover (mouse proximity)
      const distance = Math.sqrt(
        Math.pow(mouse.x * 5 - icon.position.x, 2) +
        Math.pow(mouse.y * 5 - icon.position.y, 2)
      );
      
      if (distance < 2) {
        icon.userData.speed = 0.005;
        icon.material.opacity = 0.8;
      } else {
        icon.userData.speed = 0.001 + Math.random() * 0.002;
      }
    });
  }
  
  // Animate grid floor
  if (gridFloor) {
    gridFloor.material.opacity = 0.1 + Math.sin(time) * 0.1;
  }
  
  // Animate particles (digital rain)
  if (particles) {
    const positions = particles.geometry.attributes.position.array;
    const velocities = particles.userData.velocities;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] -= velocities[i / 3];
      
      // Reset particle when it falls below
      if (positions[i + 1] < -10) {
        positions[i + 1] = 10;
      }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
  }
  
  // Render scene
  renderer.render(scene, camera);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init3DModel);
} else {
  init3DModel();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Stop animation
  isAnimating = false;
  
  // Dispose of all geometries and materials
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
  
  // Dispose of renderer
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement = null;
    renderer = null;
  }
  
  // Clear references
  scene = null;
  camera = null;
  dodecahedron = null;
  orbitingIcons = null;
  dataCore = null;
  gridFloor = null;
  particles = null;
});
