/**
 * The crop season story in 3D: one field followed through four steps — weather from
 * satellite, crop greenness, soil layers and moisture, and advice reaching the farmer.
 * `progress` (0..1) drives growth and which step is shown; the camera glides to each step.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { createStage } from '../stage';
import { clamp, easeInOut, lerp, seededRandom } from '../math';
import { prefersReducedMotion } from '../webgl';
import { createLabelLayer } from './labels';
import {
  SOIL_BANDS,
  buildFieldBlock,
  buildHouse,
  buildMast,
  buildSatellite,
  buildTrees,
  createFieldShape,
  maizePlantGeometry,
  placePlants,
  plantSpots,
  tasselGeometry,
  tintPlants,
} from './fieldParts';
import type { SceneController } from '../useThreeScene';

export interface AgroStoryParams {
  progress: number;
  labels: { topsoil: string; subsoil: string; clay: string; moisture: string; sms: string[] };
}

const BACKGROUND = '#0d1a14';
const CAMERA: Array<{ position: [number, number, number]; target: [number, number, number] }> = [
  { position: [13.5, 11, 15], target: [0, 2.4, 0] },
  { position: [7.5, 11, 10.5], target: [0, 0, 0.3] },
  { position: [2.5, 0.6, 13.5], target: [0, -1.1, 3] },
  { position: [-13, 6.5, 11], target: [-2, 0.4, -1] },
];

const stageOf = (progress: number) => Math.min(3, Math.max(0, Math.floor(clamp(progress) * 4)));

export function createAgroStoryScene(container: HTMLElement, initial: AgroStoryParams) {
  const reduced = prefersReducedMotion();
  const stage = createStage(container, {
    background: BACKGROUND,
    cameraPosition: CAMERA[0].position,
    target: CAMERA[0].target,
    fog: [26, 60],
    minDistance: 6,
    maxDistance: 34,
    maxPolarAngle: Math.PI * 0.49,
  });
  const { scene, camera, controls, sun } = stage;
  const labels = createLabelLayer(container, stage);

  // Field
  const shape = createFieldShape(42);
  shape.margin = 1.2;
  const field = buildFieldBlock(shape, 0.6);
  scene.add(field);
  scene.add(buildTrees(shape, 18, 5));
  const house = buildHouse();
  house.position.set(-5.1, shape.height(-5.1, -3.6), -3.6);
  scene.add(house);
  const mast = buildMast();
  mast.position.set(5.2, shape.height(5.2, -3.7), -3.7);
  scene.add(mast);

  // Plants
  const spots = plantSpots(shape, 0.6, 0.34, 3);
  const plants = new InstancedMesh(maizePlantGeometry(), new MeshStandardMaterial({ roughness: 0.75, side: DoubleSide }), spots.length);
  plants.castShadow = true;
  plants.receiveShadow = true;
  scene.add(plants);
  const tassels = new InstancedMesh(tasselGeometry(), new MeshStandardMaterial({ color: '#d6b45c', roughness: 0.8 }), spots.length);
  tassels.castShadow = true;
  scene.add(tassels);

  // Step 1: satellite, cloud and rain
  const satellite = buildSatellite();
  scene.add(satellite);
  const cloud = new Group();
  const puff = new MeshStandardMaterial({ color: '#e9eef0', roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
  const rand = seededRandom(9);
  for (let i = 0; i < 7; i++) {
    const p = new Mesh(new IcosahedronGeometry(0.7 + rand() * 0.6, 1), puff);
    p.position.set((i - 3) * 0.75, rand() * 0.4, (rand() - 0.5) * 1.2);
    p.castShadow = true;
    cloud.add(p);
  }
  cloud.position.set(-2.5, 5.4, 0.5);
  scene.add(cloud);
  const DROPS = 420;
  const rainPositions = new Float32Array(DROPS * 6);
  const dropSeeds = Array.from({ length: DROPS }, () => [(rand() - 0.5) * 5.5, rand() * 6, (rand() - 0.5) * 2.4]);
  const rainGeometry = new BufferGeometry();
  rainGeometry.setAttribute('position', new BufferAttribute(rainPositions, 3));
  const rain = new LineSegments(rainGeometry, new LineBasicMaterial({ color: '#9cc3e6', transparent: true, opacity: 0.55 }));
  scene.add(rain);

  // Step 2: greenness grid over the canopy
  const CELL = 1;
  const cells: Array<[number, number]> = [];
  for (let x = -shape.width / 2 + shape.margin + CELL / 2; x < shape.width / 2 - shape.margin; x += CELL) {
    for (let z = -shape.depth / 2 + shape.margin + CELL / 2; z < shape.depth / 2 - shape.margin; z += CELL) cells.push([x, z]);
  }
  const grid = new InstancedMesh(new BoxGeometry(CELL * 0.94, 0.02, CELL * 0.94), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), cells.length);
  const vigourAt = (x: number, z: number) => {
    const near = spots.filter(s => Math.abs(s.x - x) < CELL / 2 && Math.abs(s.z - z) < CELL / 2);
    return near.length ? near.reduce((sum, s) => sum + s.vigour, 0) / near.length : 0.5;
  };
  const low = new Color('#E69F00');
  const high = new Color('#009E73');
  const cellColor = new Color();
  const holder = new Object3D();
  cells.forEach(([x, z], i) => {
    holder.position.set(x, 1.6, z);
    holder.updateMatrix();
    grid.setMatrixAt(i, holder.matrix);
    grid.setColorAt(i, cellColor.copy(low).lerp(high, vigourAt(x, z)));
  });
  scene.add(grid);
  const scanLine = new Mesh(new PlaneGeometry(0.06, shape.depth - shape.margin * 2), new MeshBasicMaterial({ color: '#56B4E9', transparent: true, opacity: 0 }));
  scanLine.rotation.x = -Math.PI / 2;
  scene.add(scanLine);

  // Step 3: roots on the front wall and a moisture band in the subsoil
  const front = shape.depth / 2 + 0.012;
  const rootPositions: number[] = [];
  spots.filter(s => s.z > shape.depth / 2 - shape.margin - 0.6).forEach(s => {
    let x = s.x;
    let y = shape.height(s.x, front);
    for (let k = 0; k < 7; k++) {
      const nx = x + (rand() - 0.5) * 0.18;
      const ny = y - 0.09 - rand() * 0.06;
      rootPositions.push(x, y, front, nx, ny, front);
      if (k % 2 === 0) rootPositions.push(x, y, front, x + (rand() - 0.5) * 0.3, y - 0.12, front);
      x = nx;
      y = ny;
    }
  });
  const rootGeometry = new BufferGeometry();
  rootGeometry.setAttribute('position', new BufferAttribute(new Float32Array(rootPositions), 3));
  const roots = new LineSegments(rootGeometry, new LineBasicMaterial({ color: '#efe2c4', transparent: true, opacity: 0 }));
  scene.add(roots);
  const moisture = new Mesh(
    new PlaneGeometry(shape.width, SOIL_BANDS[1].depth - SOIL_BANDS[0].depth),
    new MeshBasicMaterial({ color: '#0072B2', transparent: true, opacity: 0, depthWrite: false })
  );
  moisture.position.set(0, -(SOIL_BANDS[0].depth + SOIL_BANDS[1].depth) / 2, front + 0.004);
  scene.add(moisture);

  // Step 4: signal pulses from the mast to the house
  const PULSES = 6;
  const pulses = Array.from({ length: PULSES }, () => {
    const pulse = new Mesh(new SphereGeometry(0.11, 12, 8), new MeshBasicMaterial({ color: '#56B4E9', transparent: true, opacity: 0 }));
    scene.add(pulse);
    return pulse;
  });
  const mastTop = new Vector3(5.2, mast.position.y + 2.4, -3.7);
  const houseTop = new Vector3(house.position.x, house.position.y + 0.9, house.position.z);

  // Camera moves between steps
  let shownStage = -1;
  let move: { from: Vector3; fromTarget: Vector3; to: Vector3; toTarget: Vector3; t: number } | null = null;
  let params = initial;

  const apply = (next: AgroStoryParams) => {
    params = next;
    const p = clamp(next.progress);
    const growth = 0.22 + 0.78 * clamp(p / 0.8);
    placePlants(plants, spots, growth);
    const step = stageOf(p);
    tintPlants(plants, spots, '#3f8a4c', step === 1 ? '#b59a3c' : '#6f9a48', s => (step === 1 ? s.vigour : 0.6 + s.vigour * 0.4));
    tassels.visible = growth > 0.86;
    if (tassels.visible) placePlants(tassels, spots, growth);
    if (step !== shownStage) {
      const preset = CAMERA[step];
      if (shownStage === -1 || reduced) {
        camera.position.set(...preset.position);
        controls.target.set(...preset.target);
      } else {
        move = { from: camera.position.clone(), fromTarget: controls.target.clone(), to: new Vector3(...preset.position), toTarget: new Vector3(...preset.target), t: 0 };
      }
      shownStage = step;
    }
    const { topsoil, subsoil, clay, sms } = next.labels;
    labels.set('topsoil', [topsoil], [-3.6, -SOIL_BANDS[0].depth / 2, front], step === 2 ? 1 : 0);
    labels.set('subsoil', [subsoil, next.labels.moisture], [-1.2, -(SOIL_BANDS[0].depth + SOIL_BANDS[1].depth) / 2, front], step === 2 ? 1 : 0);
    labels.set('clay', [clay], [1.6, -(SOIL_BANDS[1].depth + SOIL_BANDS[2].depth) / 2, front], step === 2 ? 1 : 0);
    labels.set('sms', sms, [houseTop.x, houseTop.y + 0.5, houseTop.z], step === 3 ? 1 : 0);
    stage.invalidate();
  };

  const fade = (current: number, target: number, delta: number) =>
    reduced ? target : lerp(current, target, Math.min(1, delta * 4));

  stage.onFrame((delta, elapsed) => {
    const step = stageOf(params.progress);
    if (move) {
      move.t = Math.min(1, move.t + delta / 1.6);
      const e = easeInOut(move.t);
      camera.position.lerpVectors(move.from, move.to, e);
      controls.target.lerpVectors(move.fromTarget, move.toTarget, e);
      if (move.t >= 1) move = null;
    }
    // Sun arcs slowly across the sky over the season.
    const sunAngle = -0.6 + clamp(params.progress) * 1.6;
    sun.position.set(Math.sin(sunAngle) * 18, 20, Math.cos(sunAngle) * 12);
    const time = reduced ? 0 : elapsed;

    // Step 1
    const weather = step === 0 ? 1 : 0;
    satellite.visible = step === 0 || step === 1;
    satellite.position.set(Math.cos(time * 0.25) * 6.5, 7.4, Math.sin(time * 0.25) * 4.5);
    satellite.lookAt(0, 0, 0);
    cloud.visible = weather > 0;
    rain.visible = weather > 0;
    if (rain.visible) {
      for (let i = 0; i < DROPS; i++) {
        const [dx, dy, dz] = dropSeeds[i];
        const y = 5.8 - ((dy + time * 6) % 6);
        rainPositions.set([cloud.position.x + dx, y, cloud.position.z + dz, cloud.position.x + dx, y - 0.22, cloud.position.z + dz], i * 6);
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }

    // Step 2
    const gridMaterial = grid.material as MeshBasicMaterial;
    gridMaterial.opacity = fade(gridMaterial.opacity, step === 1 ? 0.62 : 0, delta);
    grid.visible = gridMaterial.opacity > 0.01;
    const scanMaterial = scanLine.material as MeshBasicMaterial;
    scanMaterial.opacity = fade(scanMaterial.opacity, step === 1 ? 0.9 : 0, delta);
    const span = shape.width / 2 - shape.margin;
    scanLine.position.set(-span + ((time * 1.4) % (span * 2)), 1.64, 0);

    // Step 3
    const rootMaterial = roots.material as LineBasicMaterial;
    rootMaterial.opacity = fade(rootMaterial.opacity, step === 2 ? 0.85 : 0, delta);
    const moistureMaterial = moisture.material as MeshBasicMaterial;
    moistureMaterial.opacity = fade(moistureMaterial.opacity, step === 2 ? 0.28 + Math.sin(time * 1.5) * 0.04 : 0, delta);

    // Step 4
    pulses.forEach((pulse, i) => {
      const material = pulse.material as MeshBasicMaterial;
      const t = (time * 0.35 + i / PULSES) % 1;
      pulse.position.lerpVectors(mastTop, houseTop, t);
      pulse.position.y += Math.sin(t * Math.PI) * 1.6;
      material.opacity = fade(material.opacity, step === 3 ? Math.sin(t * Math.PI) : 0, delta);
    });
  });

  // Animation runs while something moves; with reduced motion only camera moves animate.
  stage.setAnimating(!reduced);
  apply(initial);

  const controller: SceneController<AgroStoryParams> = {
    update: next => apply(next),
    dispose: () => labels.dispose(),
  };
  return { stage, controller };
}
