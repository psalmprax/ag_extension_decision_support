import { describe, it, expect } from 'vitest';
import { OfflineConflictResolver, VersionedEntity } from '../services/offlineConflictResolver';

interface FarmerProfile extends VersionedEntity {
  id: string;
  name: string;
  phone: string;
  hectares: number;
  creditScore: number;
  updatedAt: string;
}

describe('Deep-Tier Data Integrity — Offline 3-Way Field-Level Conflict Resolution', () => {
  const baseFarmer: FarmerProfile = {
    id: 'farmer_001',
    name: 'John Doe',
    phone: '+254711000111',
    hectares: 2.0,
    creditScore: 650,
    updatedAt: '2026-08-15T08:00:00Z',
  };

  it('should auto-merge non-overlapping concurrent edits across different fields', () => {
    // Officer in field updates hectares offline
    const localFarmer: FarmerProfile = {
      ...baseFarmer,
      hectares: 3.5,
      updatedAt: '2026-08-18T06:00:00Z',
    };

    // Supervisor at headquarters updates credit score concurrently
    const remoteFarmer: FarmerProfile = {
      ...baseFarmer,
      creditScore: 720,
      updatedAt: '2026-08-18T05:00:00Z',
    };

    const result = OfflineConflictResolver.resolveConflict(baseFarmer, localFarmer, remoteFarmer);

    expect(result.hasConflict).toBe(false);
    expect(result.resolutionStrategy).toBe('auto_merged_field_level');
    // Both independent changes are preserved!
    expect(result.merged.hectares).toBe(3.5);
    expect(result.merged.creditScore).toBe(720);
    expect(result.merged.phone).toBe('+254711000111');
  });

  it('should resolve same-field conflict using field modification timestamp (Last-Write-Wins)', () => {
    const localFarmer: FarmerProfile = {
      ...baseFarmer,
      phone: '+254722999888', // Updated later at 10:00
      updatedAt: '2026-08-18T10:00:00Z',
    };

    const remoteFarmer: FarmerProfile = {
      ...baseFarmer,
      phone: '+254733111222', // Updated earlier at 09:00
      updatedAt: '2026-08-18T09:00:00Z',
    };

    const result = OfflineConflictResolver.resolveConflict(baseFarmer, localFarmer, remoteFarmer);

    expect(result.hasConflict).toBe(false);
    expect(result.merged.phone).toBe('+254722999888'); // Newer timestamp wins
  });

  it('should flag true simultaneous conflict on identical timestamps for manual review', () => {
    const identicalTime = '2026-08-18T08:00:00Z';
    const localFarmer: FarmerProfile = {
      ...baseFarmer,
      name: 'Johnathan Doe',
      updatedAt: identicalTime,
    };

    const remoteFarmer: FarmerProfile = {
      ...baseFarmer,
      name: 'John D. Doe',
      updatedAt: identicalTime,
    };

    const result = OfflineConflictResolver.resolveConflict(
      baseFarmer,
      localFarmer,
      remoteFarmer,
      { name: identicalTime },
      { name: identicalTime }
    );

    expect(result.hasConflict).toBe(true);
    expect(result.conflictingFields).toContain('name');
    expect(result.resolutionStrategy).toBe('manual_review_required');
  });
});
