/**
 * ============================================================================
 * AG-EXTENSION DECISION SUPPORT SYSTEM: OFFLINE 3-WAY FIELD-LEVEL CONFLICT RESOLVER
 * ============================================================================
 *
 * Implements DTP-05 Deep-Tier Mission-Critical Controls:
 * Performs granular field-by-field merge with microsecond/millisecond timestamps
 * to prevent concurrent edit data loss between offline field officers and headquarters.
 */

export interface FieldTimestamps {
  [field: string]: number;
}

export interface ConflictResolutionOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  localUpdatedAt?: number;
  remoteUpdatedAt?: number;
  localFieldTimestamps?: FieldTimestamps;
  remoteFieldTimestamps?: FieldTimestamps;
  strategy?: 'field-timestamp-lww' | 'remote-wins' | 'local-wins';
  customResolvers?: Partial<{
    [K in keyof T]: (baseVal: T[K], localVal: T[K], remoteVal: T[K]) => T[K];
  }>;
}

export interface FieldConflict<V = unknown> {
  field: string;
  baseValue: V;
  localValue: V;
  remoteValue: V;
  resolvedValue: V;
  resolution: 'local' | 'remote' | 'custom' | 'manual';
}

export interface ThreeWayMergeResult<T extends Record<string, unknown> = Record<string, unknown>> {
  merged: T;
  conflicts: FieldConflict[];
  hasConflicts: boolean;
}

/**
 * Deep equality helper for primitive values, objects, and arrays.
 */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }
  return true;
}

function objectsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Deep equality helper for primitive values, objects, and arrays.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b);
  }
  return objectsEqual(a as Record<string, unknown>, b as Record<string, unknown>);
}

function setField<T extends Record<string, unknown>>(merged: T, key: string, value: unknown): void {
  if (value !== undefined) {
    Object.defineProperty(merged, key, { value, enumerable: true, writable: true, configurable: true });
  } else {
    delete merged[key as keyof T];
  }
}

function resolveTimestampLww(
  lTs: number,
  rTs: number,
  localVal: unknown,
  remoteVal: unknown
): { value: unknown; resolution: 'local' | 'remote' | 'manual' } {
  if (lTs > rTs) {
    return { value: localVal, resolution: 'local' };
  }
  if (rTs > lTs) {
    return { value: remoteVal, resolution: 'remote' };
  }
  return { value: remoteVal, resolution: 'manual' };
}

interface ConflictChoice {
  value: unknown;
  resolution: 'local' | 'remote' | 'custom' | 'manual';
}

function resolveSingleConflict<T extends Record<string, unknown>>(
  key: string,
  baseVal: unknown,
  localVal: unknown,
  remoteVal: unknown,
  options: ConflictResolutionOptions<T>
): ConflictChoice {
  const customResolver = options.customResolvers?.[key as keyof T];
  if (customResolver) {
    const resolved = customResolver(
      baseVal as T[keyof T],
      localVal as T[keyof T],
      remoteVal as T[keyof T]
    );
    return { value: resolved, resolution: 'custom' };
  }

  const strategy = options.strategy || 'field-timestamp-lww';
  if (strategy === 'local-wins') {
    return { value: localVal, resolution: 'local' };
  }
  if (strategy === 'remote-wins') {
    return { value: remoteVal, resolution: 'remote' };
  }

  const lTs = options.localFieldTimestamps?.[key] ?? (options.localUpdatedAt ?? 0);
  const rTs = options.remoteFieldTimestamps?.[key] ?? (options.remoteUpdatedAt ?? 0);
  return resolveTimestampLww(lTs, rTs, localVal, remoteVal);
}

/**
 * Executes a deterministic 3-way granular field-level merge between:
 * 1. `base`: The record snapshot at the time the offline officer synced/cached it.
 * 2. `local`: The offline edits made by the field officer.
 * 3. `remote`: The current authoritative state at headquarters.
 */
export function resolveOfflineConflict<T extends Record<string, unknown>>(
  base: T,
  local: T,
  remote: T,
  options: ConflictResolutionOptions<T> = {}
): ThreeWayMergeResult<T> {
  const merged = { ...base } as T;
  const conflicts: FieldConflict[] = [];

  const allKeys = Array.from(
    new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
  );

  for (const key of allKeys) {
    const baseVal = base[key];
    const localVal = local[key];
    const remoteVal = remote[key];

    const localChanged = !deepEqual(localVal, baseVal);
    const remoteChanged = !deepEqual(remoteVal, baseVal);

    if (!localChanged && !remoteChanged) {
      setField(merged, key, baseVal);
    } else if (localChanged && !remoteChanged) {
      setField(merged, key, localVal);
    } else if (!localChanged && remoteChanged) {
      setField(merged, key, remoteVal);
    } else if (deepEqual(localVal, remoteVal)) {
      setField(merged, key, localVal);
    } else {
      const choice = resolveSingleConflict(key, baseVal, localVal, remoteVal, options);
      setField(merged, key, choice.value);
      conflicts.push({
        field: key,
        baseValue: baseVal,
        localValue: localVal,
        remoteValue: remoteVal,
        resolvedValue: choice.value,
        resolution: choice.resolution,
      });
    }
  }

  return {
    merged,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}
