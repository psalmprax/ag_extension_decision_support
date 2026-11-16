import { describe, it, expect } from 'vitest';
import { visitTypeLabel } from '@/lib/visitType';

describe('visitTypeLabel', () => {
  it('turns stored codes into readable labels', () => {
    expect(visitTypeLabel('pest_control')).toBe('Pest control');
    expect(visitTypeLabel('routine')).toBe('Routine');
    expect(visitTypeLabel('FOLLOW-UP')).toBe('Follow up');
  });
  it('falls back for a missing type', () => {
    expect(visitTypeLabel(undefined)).toBe('Routine visit');
    expect(visitTypeLabel('  ')).toBe('Routine visit');
  });
});
