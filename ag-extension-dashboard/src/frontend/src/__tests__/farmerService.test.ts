import { describe, it, expect, vi } from 'vitest';

// Unmock the module to get real exports
vi.unmock('@/api/farmerService');
vi.unmock('@/api/client');

import * as farmerService from '@/api/farmerService';

describe('farmerService', () => {
  it('should export fetchFarmers', () => {
    expect(typeof farmerService.fetchFarmers).toBe('function');
  });

  it('should export createFarmer', () => {
    expect(typeof farmerService.createFarmer).toBe('function');
  });
});
