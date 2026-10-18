import { describe, it, expect } from 'vitest';
import { resolveOfflineConflict } from '@/services/offlineConflictResolver';

describe('DTP-05: Offline 3-Way Field-Level Conflict Resolver', () => {
  const baseFarmer = {
    id: 'farmer_101',
    firstName: 'John',
    lastName: 'Kamau',
    phone: '+254711000111',
    crops: ['Maize', 'Beans'],
    vitalScore: 70,
    soilMoisture: 40.5,
  };

  it('merges non-conflicting field edits from both local and remote simultaneously', () => {
    // Local offline officer updated phone number and soil moisture
    const local = {
      ...baseFarmer,
      phone: '+254799888777',
      soilMoisture: 45.0,
    };

    // Remote HQ updated crops and vitalScore
    const remote = {
      ...baseFarmer,
      crops: ['Maize', 'Beans', 'Sorghum'],
      vitalScore: 78,
    };

    const result = resolveOfflineConflict(baseFarmer, local, remote);

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({
      id: 'farmer_101',
      firstName: 'John',
      lastName: 'Kamau',
      phone: '+254799888777', // from local
      crops: ['Maize', 'Beans', 'Sorghum'], // from remote
      vitalScore: 78, // from remote
      soilMoisture: 45.0, // from local
    });
  });

  it('resolves conflicting edits on the same field using granular field timestamps (LWW)', () => {
    // Both updated vitalScore
    const local = { ...baseFarmer, vitalScore: 82 };
    const remote = { ...baseFarmer, vitalScore: 75 };

    // Local update happened later (12:00 vs 11:00)
    const result = resolveOfflineConflict(baseFarmer, local, remote, {
      localFieldTimestamps: { vitalScore: 1700003600000 },
      remoteFieldTimestamps: { vitalScore: 1700000000000 },
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('vitalScore');
    expect(result.conflicts[0].resolution).toBe('local');
    expect(result.merged.vitalScore).toBe(82);
  });

  it('favors remote if remote field timestamp is newer', () => {
    const local = { ...baseFarmer, soilMoisture: 38.0 };
    const remote = { ...baseFarmer, soilMoisture: 42.0 };

    const result = resolveOfflineConflict(baseFarmer, local, remote, {
      localFieldTimestamps: { soilMoisture: 1700000000000 },
      remoteFieldTimestamps: { soilMoisture: 1700007200000 },
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].resolution).toBe('remote');
    expect(result.merged.soilMoisture).toBe(42.0);
  });

  it('supports custom resolver function for complex field merging (e.g. array set union)', () => {
    const local = { ...baseFarmer, crops: ['Maize', 'Beans', 'Cassava'] };
    const remote = { ...baseFarmer, crops: ['Maize', 'Beans', 'Coffee'] };

    const result = resolveOfflineConflict(baseFarmer, local, remote, {
      customResolvers: {
        crops: (_base, loc, rem) => Array.from(new Set([...loc, ...rem])),
      },
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].resolution).toBe('custom');
    expect(result.merged.crops.sort()).toEqual(['Beans', 'Cassava', 'Coffee', 'Maize']);
  });

  it('identifies identical changes made by both sides as non-conflicting', () => {
    const local = { ...baseFarmer, lastName: 'Kariuki' };
    const remote = { ...baseFarmer, lastName: 'Kariuki' };

    const result = resolveOfflineConflict(baseFarmer, local, remote);

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.lastName).toBe('Kariuki');
  });

  it('marks timestamp ties as manual review while safely falling back to remote', () => {
    const local = { ...baseFarmer, phone: '+254711111111' };
    const remote = { ...baseFarmer, phone: '+254722222222' };

    const result = resolveOfflineConflict(baseFarmer, local, remote, {
      localUpdatedAt: 1700000000000,
      remoteUpdatedAt: 1700000000000,
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].resolution).toBe('manual');
    expect(result.merged.phone).toBe('+254722222222');
  });
});
