export interface VersionedEntity {
  id: string;
  updatedAt: string; // ISO 8601 timestamp
  version?: number;
  [key: string]: unknown;
}

export interface MergeResult<T> {
  merged: T;
  hasConflict: boolean;
  conflictingFields: string[];
  resolutionStrategy: 'auto_merged_field_level' | 'local_wins' | 'remote_wins' | 'manual_review_required';
}

/**
 * 3-Way Field-Level Conflict Resolution Engine
 * Handles concurrent edits between offline field officers and district server updates
 * without silent data loss or overwriting.
 */
export class OfflineConflictResolver {
  private static compareValues(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private static resolveFieldConflict(
    localVal: unknown,
    remoteVal: unknown,
    localTime: number,
    remoteTime: number
  ): { value: unknown; hasConflict: boolean } {
    if (localTime > remoteTime) {
      return { value: localVal, hasConflict: false };
    }
    if (remoteTime > localTime) {
      return { value: remoteVal, hasConflict: false };
    }
    return { value: localVal, hasConflict: true };
  }

  private static mergeSingleField(
    key: string,
    baseSnapshot: VersionedEntity | null,
    localEntity: VersionedEntity,
    remoteEntity: VersionedEntity,
    localFieldTimestamps: Record<string, string>,
    remoteFieldTimestamps: Record<string, string>
  ): { value: unknown; hasConflict: boolean } {
    const localVal = localEntity[key];
    const remoteVal = remoteEntity[key];
    const baseVal = baseSnapshot ? baseSnapshot[key] : undefined;

    if (this.compareValues(localVal, remoteVal)) {
      return { value: localVal, hasConflict: false };
    }
    if (baseSnapshot && this.compareValues(remoteVal, baseVal)) {
      return { value: localVal, hasConflict: false };
    }
    if (baseSnapshot && this.compareValues(localVal, baseVal)) {
      return { value: remoteVal, hasConflict: false };
    }

    const localTime = new Date(localFieldTimestamps[key] || localEntity.updatedAt).getTime();
    const remoteTime = new Date(remoteFieldTimestamps[key] || remoteEntity.updatedAt).getTime();

    return this.resolveFieldConflict(localVal, remoteVal, localTime, remoteTime);
  }

  /**
   * Resolves conflicts between a local offline entity and a remote server entity.
   * Performs granular field-by-field merge based on field modification timestamps.
   */
  static resolveConflict<T extends VersionedEntity>(
    baseSnapshot: T | null,
    localEntity: T,
    remoteEntity: T,
    localFieldTimestamps: Record<string, string> = {},
    remoteFieldTimestamps: Record<string, string> = {}
  ): MergeResult<T> {
    const conflictingFields: string[] = [];
    const merged: Record<string, unknown> = { ...remoteEntity };
    const allKeys = new Set([...Object.keys(localEntity), ...Object.keys(remoteEntity)]);

    for (const key of allKeys) {
      if (key === 'id' || key === 'updatedAt' || key === 'version') continue;

      const { value, hasConflict } = this.mergeSingleField(
        key,
        baseSnapshot,
        localEntity,
        remoteEntity,
        localFieldTimestamps,
        remoteFieldTimestamps
      );

      merged[key] = value;
      if (hasConflict) {
        conflictingFields.push(key);
      }
    }

    const latestTimestamp = new Date(
      Math.max(new Date(localEntity.updatedAt).getTime(), new Date(remoteEntity.updatedAt).getTime())
    ).toISOString();
    merged.updatedAt = latestTimestamp;

    const hasConflict = conflictingFields.length > 0;
    const resolutionStrategy = hasConflict
      ? 'manual_review_required'
      : 'auto_merged_field_level';

    return {
      merged: merged as T,
      hasConflict,
      conflictingFields,
      resolutionStrategy,
    };
  }
}
