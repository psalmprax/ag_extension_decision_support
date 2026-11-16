import { describe, it, expect } from 'vitest';
import { passRateLabel, ratePercent } from '@/lib/rates';

describe('admin rates', () => {
  it('shows no rate when nothing has run', () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(passRateLabel(0, 0)).toBe('no runs yet');
  });
  it('computes the rate from real counts', () => {
    expect(ratePercent(3, 4)).toBe('75%');
    expect(passRateLabel(197, 3)).toBe('99% pass');
  });
});
