/**
 * Labels for the WorldMonitor pest swarm layer. The backend reports a status so
 * that a missing data source is never displayed as "0 clusters" — on a pest
 * monitoring map, an empty count reads as an all-clear.
 */
export type PestSwarmStatus = 'live' | 'no_data_source' | 'unavailable';

export interface PestSwarmLayerSummary {
  /** Absent from older backends, which only ever queried a live source. */
  status?: PestSwarmStatus;
  clusters: unknown[];
}

export function pestSwarmLabel(layer: PestSwarmLayerSummary | undefined): string {
  if (!layer) return '—';
  if (layer.status === 'no_data_source') return 'No data source';
  if (layer.status === 'unavailable') return 'Unavailable';
  return `${layer.clusters.length} ${layer.clusters.length === 1 ? 'cluster' : 'clusters'}`;
}

export function liveLayersSummary(status: PestSwarmStatus | undefined): string {
  if (status === 'no_data_source' || status === 'unavailable') {
    return '3 live layers (farmers, NDVI 30d, SoilGrids 250m centroid); pest swarm is not connected';
  }
  return '4 live layers (farmers, NDVI 30d, SoilGrids 250m centroid, pest swarm)';
}
