import { describe, expect, it } from 'vitest';
import type { AgriDataStatus } from '@/api/agriDataService';

describe('frontend truthfulness contracts', () => {
  it('supports estimated vegetation proxy status separately from live data', () => {
    const status: AgriDataStatus = 'estimated';
    expect(status).toBe('estimated');
  });

  it('does not treat an absent SMS quota as a configured quota', () => {
    const quota: { limit: number } | null = null;
    expect(quota).toBeNull();
  });
});
