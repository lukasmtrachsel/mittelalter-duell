// Turnierwiese mit Holzzaun (nur Grafik, Kollision liegt in sim.ts).
import * as THREE from 'three';
import { balance } from '../../core/config';

export function buildArena(scene: THREE.Scene): void {
  const { width, depth, fenceHeight } = balance.arena;

  scene.background = new THREE.Color(0xa9c7e0);
  scene.fog = new THREE.Fog(0xa9c7e0, 40, 110);

  // Licht
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a5a2a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -width / 2 - 3; sc.right = width / 2 + 3;
  sc.top = depth / 2 + 3; sc.bottom = -depth / 2 - 3;
  sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Wiese mit leichter Farbvariation
  const groundGeo = new THREE.PlaneGeometry(200, 200, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const colors: number[] = [];
  const pos = groundGeo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const inside = Math.abs(x) < width / 2 && Math.abs(z) < depth / 2;
    const n = Math.sin(x * 0.7) * Math.cos(z * 0.5) * 0.04 + (Math.random() - 0.5) * 0.04;
    // Innen etwas ausgetreten (heller, bräunlicher)
    if (inside) c.setRGB(0.42 + n, 0.5 + n, 0.25 + n);
    else c.setRGB(0.3 + n, 0.48 + n, 0.2 + n);
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Holzzaun: Pfosten + zwei Latten pro Seite
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.95 });
  const postGeo = new THREE.BoxGeometry(0.14, fenceHeight + 0.15, 0.14);
  const posts = new THREE.InstancedMesh(postGeo, wood, 200);
  posts.castShadow = true;
  let count = 0;
  const m = new THREE.Matrix4();
  const addPost = (x: number, z: number) => {
    m.makeTranslation(x, (fenceHeight + 0.15) / 2, z);
    posts.setMatrixAt(count++, m);
  };
  const spacing = 2.5;
  for (let x = -width / 2; x <= width / 2 + 0.01; x += spacing) { addPost(x, -depth / 2); addPost(x, depth / 2); }
  for (let z = -depth / 2 + spacing; z < depth / 2 - 0.01; z += spacing) { addPost(-width / 2, z); addPost(width / 2, z); }
  posts.count = count;
  scene.add(posts);

  const rail = (len: number, x: number, z: number, alongX: boolean, y: number) => {
    const g = alongX ? new THREE.BoxGeometry(len, 0.09, 0.06) : new THREE.BoxGeometry(0.06, 0.09, len);
    const r = new THREE.Mesh(g, wood);
    r.position.set(x, y, z);
    r.castShadow = true;
    scene.add(r);
  };
  for (const y of [fenceHeight * 0.45, fenceHeight * 0.9]) {
    rail(width, 0, -depth / 2, true, y);
    rail(width, 0, depth / 2, true, y);
    rail(depth, -width / 2, 0, false, y);
    rail(depth, width / 2, 0, false, y);
  }

  // Dekoration außerhalb: Bäume und Zelte (Low-Poly)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3f26, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a27, roughness: 1, flatShading: true });
  const rnd = mulberry32(7);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 28 + rnd() * 40;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    const s = 0.8 + rnd() * 0.9;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 2 * s, 6), trunkMat);
    trunk.position.y = s;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 3.5 * s, 7), leafMat);
    crown.position.y = 3.3 * s;
    trunk.castShadow = crown.castShadow = true;
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  const tentColors = [0xb3342c, 0xe8dcc0, 0x2c4f9e, 0xd9b13b];
  for (let i = 0; i < 4; i++) {
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(2, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: tentColors[i], roughness: 0.9, flatShading: true }),
    );
    const side = i < 2 ? -1 : 1;
    tent.position.set((i % 2 === 0 ? -8 : 8), 1.6, side * (depth / 2 + 7));
    tent.castShadow = true;
    scene.add(tent);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5), trunkMat);
    pole.position.set(tent.position.x, 3.6, tent.position.z);
    scene.add(pole);
  }
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
