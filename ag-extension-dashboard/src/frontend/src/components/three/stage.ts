import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface StageOptions {
  background: string;
  cameraPosition: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  /** Stops the camera going below the ground (radians from straight down). */
  maxPolarAngle?: number;
  /** Fog start and end distances; omit for no fog. */
  fog?: [number, number];
  shadows?: boolean;
  enablePan?: boolean;
}

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  sun: DirectionalLight;
  hemisphere: HemisphereLight;
  /** Runs every animation frame with seconds since the last frame and since the start. */
  onFrame: (callback: (delta: number, elapsed: number) => void) => void;
  /** Keeps rendering every frame while true; otherwise frames are drawn only after a change. */
  setAnimating: (animating: boolean) => void;
  /** Asks for one more frame (after a parameter change). */
  invalidate: () => void;
  setBackground: (color: string) => void;
  /** Screen position in CSS pixels for a world point, and whether it is in front of the camera. */
  project: (point: Vector3) => { x: number; y: number; visible: boolean };
  dispose: () => void;
}

function disposeMaterial(material: Material) {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

function disposeObject(root: Object3D) {
  root.traverse(object => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(disposeMaterial);
    }
  });
}

/**
 * Sets up a renderer, camera, orbit controls and daylight in a container, and draws
 * only when something changes or a scene asks to animate. Rendering stops while the
 * container is off screen or the tab is hidden.
 */
export function createStage(container: HTMLElement, options: StageOptions): Stage {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = options.shadows ?? true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const background = new Color(options.background);
  scene.background = background;
  if (options.fog) scene.fog = new Fog(background.clone(), options.fog[0], options.fog[1]);

  const camera = new PerspectiveCamera(options.fov ?? 38, 1, 0.1, 400);
  camera.position.set(...options.cameraPosition);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = options.enablePan ?? false;
  controls.minDistance = options.minDistance ?? 4;
  controls.maxDistance = options.maxDistance ?? 60;
  controls.maxPolarAngle = options.maxPolarAngle ?? Math.PI * 0.47;
  controls.target.set(...(options.target ?? [0, 0, 0]));
  controls.update();

  const hemisphere = new HemisphereLight('#e8f0ea', '#4a3b2a', 1.15);
  scene.add(hemisphere);
  const sun = new DirectionalLight('#fff4e0', 2.4);
  sun.position.set(14, 22, 10);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const frameCallbacks: Array<(delta: number, elapsed: number) => void> = [];
  let animating = false;
  let needsFrame = true;
  let onScreen = true;
  let frameId = 0;
  let last = performance.now();
  const start = last;

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsFrame = true;
  };
  resize();

  const tick = (now: number) => {
    frameId = requestAnimationFrame(tick);
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    const controlsMoved = controls.update();
    if (!onScreen || document.hidden) return;
    if (!animating && !needsFrame && !controlsMoved) return;
    needsFrame = false;
    const elapsed = (now - start) / 1000;
    try {
      for (const callback of frameCallbacks) callback(delta, elapsed);
      renderer.render(scene, camera);
    } catch (error) {
      // A broken scene must not throw on every frame: stop drawing and say why once.
      cancelAnimationFrame(frameId);
      console.warn('3D view stopped:', error);
    }
  };
  frameId = requestAnimationFrame(tick);

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(container);
  const visibilityObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(entries => {
          onScreen = entries.some(entry => entry.isIntersecting);
          needsFrame = true;
        })
      : null;
  visibilityObserver?.observe(container);
  const invalidate = () => {
    needsFrame = true;
  };
  controls.addEventListener('change', invalidate);

  const scratch = new Vector3();
  return {
    scene,
    camera,
    renderer,
    controls,
    sun,
    hemisphere,
    onFrame: callback => {
      frameCallbacks.push(callback);
    },
    setAnimating: value => {
      animating = value;
      needsFrame = true;
    },
    invalidate,
    setBackground: color => {
      background.set(color);
      if (scene.fog) scene.fog.color.set(color);
      needsFrame = true;
    },
    project: point => {
      scratch.copy(point).project(camera);
      return {
        x: ((scratch.x + 1) / 2) * container.clientWidth,
        y: ((1 - scratch.y) / 2) * container.clientHeight,
        visible: scratch.z < 1 && scratch.z > -1,
      };
    },
    dispose: () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
