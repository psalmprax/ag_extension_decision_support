/**
 * The officer globe: farmers with a saved location, crop-stress readings, pest clusters
 * and the soil sample point, placed by their coordinates on a real-world globe.
 * Hovering (or tapping) a marker names it. Only real records are drawn.
 */
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  Raycaster,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { createStage } from '../stage';
import { latLonToVector } from '../math';
import { createLabelLayer } from './labels';
import { drawGlobeTexture, GLOBE_PALETTES } from './globeTexture';
import { LAYER_COLORS } from './globeColors';
import type { SceneController } from '../useThreeScene';

export interface GlobeMarker {
  lat: number;
  lon: number;
  /** Shown on hover, one line each. */
  lines: string[];
}

export interface GlobeParams {
  dark: boolean;
  farmers: GlobeMarker[];
  stress: GlobeMarker[];
  pests: Array<GlobeMarker & { severity: number }>;
  soil: GlobeMarker | null;
  /** Where the camera looks first (the data's centre, or the officer's region). */
  focus: { lat: number; lon: number; distance: number };
  layers: { farmers: boolean; stress: boolean; pests: boolean; soil: boolean };
}

const RADIUS = 1;
const MAX_MARKERS = 2000;

function cameraFor(lat: number, lon: number, distance: number): Vector3 {
  return new Vector3(...latLonToVector(lat, lon, distance));
}

export function createGlobeScene(container: HTMLElement, initial: GlobeParams) {
  const stage = createStage(container, {
    background: initial.dark ? '#0d1a14' : '#f3f6f4',
    cameraPosition: cameraFor(initial.focus.lat, initial.focus.lon, initial.focus.distance).toArray() as [number, number, number],
    minDistance: 1.15,
    maxDistance: 6,
    maxPolarAngle: Math.PI,
    shadows: false,
    fov: 35,
  });
  const { scene, camera, controls, renderer, sun, hemisphere } = stage;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.7;
  hemisphere.intensity = 1.6;
  sun.intensity = 1.2;
  const labels = createLabelLayer(container, stage);

  const surface = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const globe = new Mesh(new SphereGeometry(RADIUS, 128, 96), surface);
  scene.add(globe);
  let paintedFor: boolean | null = null;
  const paint = async (dark: boolean) => {
    if (paintedFor === dark) return;
    paintedFor = dark;
    const canvas = await drawGlobeTexture(GLOBE_PALETTES[dark ? 'dark' : 'light']);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    surface.map?.dispose();
    surface.map = texture;
    surface.needsUpdate = true;
    stage.invalidate();
  };

  const makeLayer = (geometry: CylinderGeometry | SphereGeometry | TorusGeometry | OctahedronGeometry, color: string) => {
    const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ color: new Color(color) }), MAX_MARKERS);
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  };
  const bar = new CylinderGeometry(0.0045, 0.0045, 0.06, 8);
  bar.translate(0, 0.03, 0);
  bar.rotateX(Math.PI / 2);
  const layers = {
    farmers: makeLayer(bar, LAYER_COLORS.farmers),
    stress: makeLayer(new SphereGeometry(0.0065, 10, 8), LAYER_COLORS.stress),
    pests: makeLayer(new TorusGeometry(0.02, 0.0025, 6, 32), LAYER_COLORS.pests),
    soil: makeLayer(new OctahedronGeometry(0.012), LAYER_COLORS.soil),
  };
  const shown: Record<keyof typeof layers, GlobeMarker[]> = { farmers: [], stress: [], pests: [], soil: [] };

  const holder = new Object3D();
  const origin = new Vector3();
  const place = (mesh: InstancedMesh, markers: GlobeMarker[], scale: (m: GlobeMarker) => number = () => 1) => {
    const list = markers.slice(0, MAX_MARKERS);
    list.forEach((marker, i) => {
      holder.position.set(...latLonToVector(marker.lat, marker.lon, RADIUS + 0.001));
      holder.lookAt(origin);
      holder.rotateY(Math.PI);
      const s = scale(marker);
      holder.scale.set(s, s, s);
      holder.updateMatrix();
      mesh.setMatrixAt(i, holder.matrix);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return list;
  };

  let params = initial;
  const apply = (next: GlobeParams) => {
    params = next;
    void paint(next.dark);
    stage.setBackground(next.dark ? '#0d1a14' : '#f3f6f4');
    shown.farmers = next.layers.farmers ? place(layers.farmers, next.farmers) : place(layers.farmers, []);
    shown.stress = next.layers.stress ? place(layers.stress, next.stress) : place(layers.stress, []);
    shown.pests = next.layers.pests
      ? place(layers.pests, next.pests, m => 0.8 + Math.min(3, (m as GlobeMarker & { severity: number }).severity) * 0.4)
      : place(layers.pests, []);
    shown.soil = next.layers.soil && next.soil ? place(layers.soil, [next.soil]) : place(layers.soil, []);
    stage.invalidate();
  };

  // Hover / tap: name the marker under the pointer.
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const onPointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(Object.values(layers), false);
    const globeHit = raycaster.intersectObject(globe, false)[0];
    const hit = hits.find(h => !globeHit || h.distance <= globeHit.distance + 0.02);
    const key = hit ? (Object.keys(layers) as Array<keyof typeof layers>).find(k => layers[k] === hit.object) : undefined;
    const marker = key && hit?.instanceId !== undefined ? shown[key][hit.instanceId] : undefined;
    if (marker) {
      labels.set('hover', marker.lines, latLonToVector(marker.lat, marker.lon, RADIUS + 0.06), 1);
    } else {
      labels.setOpacity('hover', 0);
    }
    renderer.domElement.style.cursor = marker ? 'pointer' : 'grab';
    stage.invalidate();
  };
  renderer.domElement.addEventListener('pointermove', onPointer);
  renderer.domElement.addEventListener('pointerdown', onPointer);

  // Keep the sun over the camera's shoulder so the side you look at is lit.
  stage.onFrame(() => {
    sun.position.copy(camera.position).multiplyScalar(4).add(new Vector3(2, 3, 0));
  });

  apply(initial);

  const controller: SceneController<GlobeParams> = {
    update: next => {
      const refocus = next.focus.lat !== params.focus.lat || next.focus.lon !== params.focus.lon;
      apply(next);
      if (refocus) {
        camera.position.copy(cameraFor(next.focus.lat, next.focus.lon, next.focus.distance));
        controls.update();
      }
    },
    dispose: () => {
      renderer.domElement.removeEventListener('pointermove', onPointer);
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      labels.dispose();
    },
  };
  return { stage, controller };
}
