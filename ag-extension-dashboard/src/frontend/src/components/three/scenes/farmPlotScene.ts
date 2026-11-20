/**
 * One farmer's plot in 3D. The canopy colour follows the latest satellite NDVI when there
 * is one, and stays a neutral green when there is not; the labels show only real values.
 */
import { DoubleSide, InstancedMesh, MeshStandardMaterial } from 'three';
import { createStage } from '../stage';
import { canopyColorForNdvi, hashString } from '../math';
import { prefersReducedMotion } from '../webgl';
import { createLabelLayer } from './labels';
import { buildFieldBlock, buildHouse, buildTrees, createFieldShape, maizePlantGeometry, placePlants, plantSpots, tintPlants } from './fieldParts';
import type { SceneController } from '../useThreeScene';

export interface FarmPlotParams {
  seed: string;
  dark: boolean;
  ndvi: number | null;
  /** Label lines pinned above the plot (already translated, real values only). */
  lines: string[];
}

export function createFarmPlotScene(container: HTMLElement, initial: FarmPlotParams) {
  const background = (dark: boolean) => (dark ? '#0d1a14' : '#eef3f0');
  const stage = createStage(container, {
    background: background(initial.dark),
    cameraPosition: [10, 8.5, 11],
    target: [0, -0.4, 0],
    fog: [24, 50],
    minDistance: 7,
    maxDistance: 26,
  });
  const labels = createLabelLayer(container, stage);
  const shape = createFieldShape(hashString(initial.seed) % 10_000, 10, 7.5);
  shape.margin = 1;
  stage.scene.add(buildFieldBlock(shape, 0.55));
  stage.scene.add(buildTrees(shape, 12, 2));
  const house = buildHouse();
  house.position.set(-4.3, shape.height(-4.3, -3), -3);
  stage.scene.add(house);
  const spots = plantSpots(shape, 0.55, 0.32, 8);
  const plants = new InstancedMesh(maizePlantGeometry(), new MeshStandardMaterial({ roughness: 0.75, side: DoubleSide }), spots.length);
  plants.castShadow = true;
  plants.receiveShadow = true;
  placePlants(plants, spots, 0.85);
  stage.scene.add(plants);

  const apply = (params: FarmPlotParams) => {
    stage.setBackground(background(params.dark));
    const canopy = canopyColorForNdvi(params.ndvi);
    // Without a reading, every plant is the same neutral green: no invented patches.
    tintPlants(plants, spots, canopy, params.ndvi === null ? canopy : '#b59a3c', s => (params.ndvi === null ? 1 : 0.55 + s.vigour * 0.45));
    labels.set('plot', params.lines, [0, 2.1, 0], params.lines.length ? 1 : 0);
    stage.invalidate();
  };

  // A slow turn shows the plot from all sides; it stops for reduced motion or while dragging.
  if (!prefersReducedMotion()) {
    stage.controls.autoRotate = true;
    stage.controls.autoRotateSpeed = 0.5;
    stage.controls.addEventListener('start', () => {
      stage.controls.autoRotate = false;
    });
    stage.setAnimating(true);
  }
  apply(initial);

  const controller: SceneController<FarmPlotParams> = { update: apply, dispose: () => labels.dispose() };
  return { stage, controller };
}
