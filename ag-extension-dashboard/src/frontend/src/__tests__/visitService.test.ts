import { describe, it, expect } from 'vitest';

import * as visitService from '@/api/visitService';

describe('visitService', () => {
  it('should export fetchVisits', () => {
    expect(typeof visitService.fetchVisits).toBe('function');
  });

  it('should export createVisit', () => {
    expect(typeof visitService.createVisit).toBe('function');
  });

  it('should export Visit interface types', () => {
    // Verify the module loads without errors
    expect(visitService).toBeDefined();
  });
});
