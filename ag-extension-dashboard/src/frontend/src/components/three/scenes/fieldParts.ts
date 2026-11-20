/**
 * Building blocks for the farm scenes: a field cut out of the ground like a diorama
 * (so its soil layers show at the sides), maize plants, trees, a farmhouse and a mast.
 * Everything is low-poly with flat shading and real shadows.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createValueNoise, fractalNoise, seededRandom } from '../math';

export const SOIL_BANDS = [
  { name: 'topsoil', depth: 0.55, color: '#5a3f2a' },
  { name: 'subsoil', depth: 1.35, color: '#8a6342' },
  { name: 'clay', depth: 2.4, color: '#a98257' },
] as const;

export interface FieldShape {
  /** Width (x) and depth (z) of the whole block, including the grass margin. */
  width: number;
  depth: number;
  /** Grass margin around the cultivated bed. */
  margin: number;
  thickness: number;
  height: (x: number, z: number) => number;
}

export function createFieldShape(seed: number, width = 12, depth = 9): FieldShape {
  const noise = createValueNoise(seed);
  return {
    width,
    depth,
    margin: 0.9,
    thickness: SOIL_BANDS[SOIL_BANDS.length - 1].depth,
    height: (x, z) => (fractalNoise(noise, x * 0.16 + 5, z * 0.16 + 9) - 0.5) * 0.45,
  };
}

const inBed = (shape: FieldShape, x: number, z: number) =>
  Math.abs(x) < shape.width / 2 - shape.margin && Math.abs(z) < shape.depth / 2 - shape.margin;

/** The top surface: furrowed soil in the bed, grass around it. */
function buildTop(shape: FieldShape, rowSpacing: number): Mesh {
  const geometry = new PlaneGeometry(shape.width, shape.depth, 120, 90);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const soil = new Color('#6b4a31');
  const furrow = new Color('#4e3522');
  const grass = new Color('#5d7a45');
  const grassDark = new Color('#4b6838');
  const rand = seededRandom(7);
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const bed = inBed(shape, x, z);
    const ridge = bed ? Math.cos((x / rowSpacing) * Math.PI * 2) * 0.03 : 0;
    position.setY(i, shape.height(x, z) + ridge);
    if (bed) c.copy(soil).lerp(furrow, (1 - Math.cos((x / rowSpacing) * Math.PI * 2)) * 0.35);
    else c.copy(grass).lerp(grassDark, rand() * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}

type Side = 'front' | 'back' | 'left' | 'right';

/** A point along the top edge of one side, t from -0.5 to 0.5. */
function sidePoint(shape: FieldShape, side: Side, t: number): [number, number] {
  if (side === 'front') return [t * shape.width, shape.depth / 2];
  if (side === 'back') return [-t * shape.width, -shape.depth / 2];
  if (side === 'left') return [-shape.width / 2, t * shape.depth];
  return [shape.width / 2, -t * shape.depth];
}

/** One side wall, from the top edge down to the bottom, coloured by soil layer. */
function buildSide(shape: FieldShape, side: Side): Mesh {
  const segments = 80;
  const rows = 24;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const noise = createValueNoise(side.length * 31);
  const c = new Color();
  for (let r = 0; r <= rows; r++) {
    for (let s = 0; s <= segments; s++) {
      const [x, z] = sidePoint(shape, side, s / segments - 0.5);
      const top = shape.height(x, z);
      const y = top - (r / rows) * (shape.thickness + top);
      positions.push(x, y, z);
      const depth = top - y + (noise(s * 0.2, r * 0.4) - 0.5) * 0.18;
      const band = SOIL_BANDS.find(b => depth <= b.depth) ?? SOIL_BANDS[SOIL_BANDS.length - 1];
      c.set(band.color).offsetHSL(0, 0, (noise(s * 0.7, r * 0.9) - 0.5) * 0.06);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

/** The field block: top, four soil walls and a dark base. */
export function buildFieldBlock(shape: FieldShape, rowSpacing = 0.55): Group {
  const group = new Group();
  group.add(buildTop(shape, rowSpacing));
  (['front', 'back', 'left', 'right'] as const).forEach(side => group.add(buildSide(shape, side)));
  const base = new Mesh(
    new BoxGeometry(shape.width, 0.04, shape.depth),
    new MeshStandardMaterial({ color: '#2a1d14', roughness: 1 })
  );
  base.position.y = -shape.thickness;
  group.add(base);
  return group;
}

/** A maize leaf: a ribbon that rises from the stalk and droops. */
function leafGeometry(length: number, width: number): BufferGeometry {
  const steps = 6;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.75) * length * 0.28 - t * t * length * 0.38;
    const w = width * Math.sin(Math.PI * Math.min(0.98, t * 0.95 + 0.04)) * (1 - t * 0.35);
    positions.push(x, y, -w / 2, x, y, w / 2);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A maize plant one unit tall: stalk and alternating leaves, merged into one geometry. */
export function maizePlantGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const stalk = new CylinderGeometry(0.012, 0.022, 1, 5, 1);
  stalk.translate(0, 0.5, 0);
  parts.push(stalk);
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const leaf = leafGeometry(0.42 - i * 0.03, 0.06);
    leaf.rotateY((i % 2 === 0 ? 0 : Math.PI) + i * 0.35);
    leaf.translate(0, 0.16 + i * 0.13, 0);
    parts.push(leaf);
  }
  // Leaves have no texture coordinates, so drop the stalk's to let the parts merge.
  const merged = mergeGeometries(
    parts.map(part => {
      const flat = part.toNonIndexed();
      flat.deleteAttribute('uv');
      return flat;
    })
  );
  if (!merged) throw new Error('Could not build the maize plant geometry');
  return merged;
}

/** The tassel at the top of a mature plant. */
export function tasselGeometry(): BufferGeometry {
  const tassel = new ConeGeometry(0.035, 0.14, 5);
  tassel.translate(0, 1.04, 0);
  return tassel;
}

export interface PlantSpot {
  x: number;
  z: number;
  y: number;
  rotation: number;
  scale: number;
  /** 0..1, used to tint the plant (low = stressed). */
  vigour: number;
}

/** Plant positions along rows in the bed, with a little variation. */
export function plantSpots(shape: FieldShape, rowSpacing: number, plantSpacing: number, seed: number): PlantSpot[] {
  const rand = seededRandom(seed);
  const noise = createValueNoise(seed + 11);
  const spots: PlantSpot[] = [];
  const halfW = shape.width / 2 - shape.margin - 0.2;
  const halfD = shape.depth / 2 - shape.margin - 0.2;
  for (let x = -halfW; x <= halfW; x += rowSpacing) {
    for (let z = -halfD; z <= halfD; z += plantSpacing) {
      const jx = x + (rand() - 0.5) * 0.05;
      const jz = z + (rand() - 0.5) * 0.12;
      spots.push({
        x: jx,
        z: jz,
        y: shape.height(jx, jz),
        rotation: rand() * Math.PI * 2,
        scale: 0.85 + rand() * 0.3,
        vigour: Math.min(1, Math.max(0, fractalNoise(noise, jx * 0.22, jz * 0.22) * 1.5 - 0.15)),
      });
    }
  }
  return spots;
}

const scratch = new Object3D();

/** Place every plant for a growth stage (0..1). Height and spread grow with it. */
export function placePlants(mesh: InstancedMesh, spots: PlantSpot[], growth: number, height = 1.25): void {
  const g = Math.max(0.05, growth);
  spots.forEach((spot, i) => {
    scratch.position.set(spot.x, spot.y, spot.z);
    scratch.rotation.set(0, spot.rotation, 0);
    const h = height * g * spot.scale;
    scratch.scale.set(0.45 + 0.75 * g, h, 0.45 + 0.75 * g);
    scratch.updateMatrix();
    mesh.setMatrixAt(i, scratch.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** Colour each plant between stressed and healthy green. */
export function tintPlants(mesh: InstancedMesh, spots: PlantSpot[], healthy: string, stressed: string, mix: (spot: PlantSpot) => number): void {
  const a = new Color(stressed);
  const b = new Color(healthy);
  const c = new Color();
  spots.forEach((spot, i) => {
    c.copy(a).lerp(b, Math.min(1, Math.max(0, mix(spot))));
    mesh.setColorAt(i, c);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Round low-poly trees along the margin. */
export function buildTrees(shape: FieldShape, count: number, seed: number): Group {
  const rand = seededRandom(seed);
  const group = new Group();
  const trunk = new CylinderGeometry(0.06, 0.09, 0.7, 6);
  trunk.translate(0, 0.35, 0);
  const crown = new IcosahedronGeometry(0.5, 0);
  const trunks = new InstancedMesh(trunk, new MeshStandardMaterial({ color: '#5b4330', roughness: 1, flatShading: true }), count);
  const crowns = new InstancedMesh(crown, new MeshStandardMaterial({ color: '#3f6b3a', roughness: 0.9, flatShading: true }), count);
  const m = new Matrix4();
  const q = new Quaternion();
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const t = rand() - 0.5;
    const inset = shape.margin * (0.3 + rand() * 0.4);
    const x = side < 2 ? t * (shape.width - 1) : (side === 2 ? -1 : 1) * (shape.width / 2 - inset);
    const z = side < 2 ? (side === 0 ? -1 : 1) * (shape.depth / 2 - inset) : t * (shape.depth - 1);
    if (side === 1 && Math.abs(x) < shape.width * 0.2) continue;
    const y = shape.height(x, z);
    const s = 0.7 + rand() * 0.6;
    m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s));
    trunks.setMatrixAt(i, m);
    m.compose(new Vector3(x, y + 0.95 * s, z), q.setFromAxisAngle(new Vector3(0, 1, 0), rand() * 3), new Vector3(s, s * 1.15, s));
    crowns.setMatrixAt(i, m);
  }
  [trunks, crowns].forEach(mesh => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

/** A small farmhouse with a pitched roof. */
export function buildHouse(): Group {
  const group = new Group();
  const walls = new Mesh(new BoxGeometry(0.9, 0.55, 0.7), new MeshStandardMaterial({ color: '#d8cdb8', roughness: 0.9 }));
  walls.position.y = 0.275;
  const roof = new Mesh(new ConeGeometry(0.72, 0.42, 4), new MeshStandardMaterial({ color: '#8c3b2a', roughness: 0.8, flatShading: true }));
  roof.position.y = 0.76;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  const door = new Mesh(new BoxGeometry(0.16, 0.3, 0.02), new MeshStandardMaterial({ color: '#4a3526' }));
  door.position.set(0, 0.15, 0.36);
  [walls, roof, door].forEach(part => {
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
  });
  return group;
}

/** A phone mast: a tapering lattice-like tower with antenna panels. */
export function buildMast(): Group {
  const group = new Group();
  const metal = new MeshStandardMaterial({ color: '#b8c0c4', roughness: 0.4, metalness: 0.6 });
  const tower = new Mesh(new CylinderGeometry(0.03, 0.12, 2.6, 4, 6, true), metal);
  tower.position.y = 1.3;
  const panels = new Group();
  for (let i = 0; i < 3; i++) {
    const panel = new Mesh(new BoxGeometry(0.06, 0.32, 0.12), new MeshStandardMaterial({ color: '#e6e8e8', roughness: 0.5 }));
    const angle = (i / 3) * Math.PI * 2;
    panel.position.set(Math.cos(angle) * 0.1, 2.35, Math.sin(angle) * 0.1);
    panel.rotation.y = -angle;
    panels.add(panel);
  }
  [tower, panels].forEach(part => {
    part.castShadow = true;
    group.add(part);
  });
  return group;
}

/** A small satellite: body and two solar wings. */
export function buildSatellite(): Group {
  const group = new Group();
  const body = new Mesh(new BoxGeometry(0.34, 0.34, 0.5), new MeshStandardMaterial({ color: '#d9b45a', roughness: 0.35, metalness: 0.7 }));
  const wing = new MeshStandardMaterial({ color: '#1f3b5c', roughness: 0.3, metalness: 0.4 });
  const left = new Mesh(new BoxGeometry(1.1, 0.02, 0.36), wing);
  left.position.x = -0.75;
  const right = left.clone();
  right.position.x = 0.75;
  const dish = new Mesh(new ConeGeometry(0.14, 0.1, 12, 1, true), new MeshStandardMaterial({ color: '#eeeeee', side: DoubleSide }));
  dish.rotation.x = Math.PI;
  dish.position.y = -0.24;
  [body, left, right, dish].forEach(part => group.add(part));
  return group;
}
