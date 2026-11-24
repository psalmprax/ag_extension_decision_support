import { useEffect, useState } from 'react';
import { releasedEdgeModels } from '@/services/edgeModelManifest';
import { cropDisplayName, modelCrops } from '@/services/edgeModelLabels';

/** The crops the released on-device model was trained on, by display name; empty when none is released. */
export function useModelCrops(): string[] {
  const [crops, setCrops] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void releasedEdgeModels().then(([model]) => {
      if (live && model) setCrops(modelCrops(model.labels).map(cropDisplayName).sort((a, b) => a.localeCompare(b)));
    });
    return () => { live = false; };
  }, []);
  return crops;
}
