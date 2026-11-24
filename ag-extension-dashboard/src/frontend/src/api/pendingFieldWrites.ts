import { boundaryMetrics, type BoundaryPoint } from '@ag-extension/shared/api';
import { syncQueue, type SyncQueueItem } from './syncQueueService';
import type { CropCycle, Field } from './fieldService';

const FIELD_PATH = /^\/v1\/fields\/([^/]+)$/;
const CYCLES_PATH = /^\/v1\/fields\/([^/]+)\/cycles$/;
const CYCLE_PATH = /^\/v1\/fields\/([^/]+)\/cycles\/([^/]+)$/;

type Values = Record<string, unknown>;

/** With a boundary, the field's location is the middle of it, as the server works it out. */
function locatedByBoundary(values: Values): Values {
  const points = values.boundaryCoordinates as BoundaryPoint[] | null | undefined;
  if (!points || points.length < 3) return values;
  const { centroid } = boundaryMetrics(points);
  return { ...values, latitude: centroid.lat, longitude: centroid.lng };
}

function newField(item: SyncQueueItem, farmerId: string | undefined): Field {
  const values = locatedByBoundary(item.data ?? {});
  const at = new Date(item.timestamp).toISOString();
  return {
    ...(values as Partial<Field>),
    id: String(values.id),
    farmerId: String(values.farmerId ?? farmerId ?? ''),
    name: String(values.name ?? ''),
    areaHectares: Number(values.areaHectares) || 0,
    isActive: true,
    createdAt: at,
    updatedAt: at,
    cropCycles: [],
    pendingSync: true,
  };
}

function applyFieldWrite(fields: Field[], item: SyncQueueItem, farmerId: string | undefined): Field[] {
  if (item.action === 'create') {
    const forFarmer = item.data?.farmerId;
    const id = item.data?.id;
    if ((farmerId && forFarmer && forFarmer !== farmerId) || fields.some(field => field.id === id)) return fields;
    return [...fields, newField(item, farmerId)];
  }
  const id = FIELD_PATH.exec(item.endpoint)?.[1];
  if (item.action === 'delete') return fields.filter(field => field.id !== id);
  return fields.map(field => (field.id === id ? { ...field, ...(locatedByBoundary(item.data ?? {}) as Partial<Field>), pendingSync: true } : field));
}

function applyCycleWrite(fields: Field[], item: SyncQueueItem): Field[] {
  const created = CYCLES_PATH.exec(item.endpoint);
  const changed = CYCLE_PATH.exec(item.endpoint);
  const fieldId = created?.[1] ?? changed?.[1];
  return fields.map(field => {
    if (field.id !== fieldId) return field;
    const cycles = field.cropCycles ?? [];
    if (created) {
      const at = new Date(item.timestamp).toISOString();
      const values = (item.data ?? {}) as Partial<CropCycle>;
      if (cycles.some(cycle => cycle.id === values.id)) return field;
      const cycle: CropCycle = { status: 'planned', cropName: '', ...values, id: String(values.id), fieldId, createdAt: at, updatedAt: at, pendingSync: true };
      return { ...field, cropCycles: [...cycles, cycle] };
    }
    const cycleId = changed?.[2];
    if (item.action === 'delete') return { ...field, cropCycles: cycles.filter(cycle => cycle.id !== cycleId) };
    return { ...field, cropCycles: cycles.map(cycle => (cycle.id === cycleId ? { ...cycle, ...(item.data as Partial<CropCycle>), pendingSync: true } : cycle)) };
  });
}

/**
 * The fields as the server sent them, with the changes saved on this device that have not
 * reached it yet laid over them in the order they were made, so a field walked offline shows
 * up at once and is marked as waiting to sync.
 */
export function withPendingFieldWrites(fields: Field[], farmerId?: string): Field[] {
  return syncQueue.getQueue().reduce((list, item) => {
    if (item.entity === 'field') return applyFieldWrite(list, item, farmerId);
    if (item.entity === 'crop_cycle') return applyCycleWrite(list, item);
    return list;
  }, fields);
}
