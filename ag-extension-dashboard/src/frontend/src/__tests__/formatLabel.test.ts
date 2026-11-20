import { describe, it, expect } from 'vitest';
import { formatLabel } from '@/lib/formatLabel';

describe('formatLabel', () => {
  it('sentence-cases stored enum values', () => {
    expect(formatLabel('pending')).toBe('Pending');
    expect(formatLabel('in_review')).toBe('In review');
    expect(formatLabel('high-risk')).toBe('High risk');
  });

  it('leaves values already written for people alone', () => {
    expect(formatLabel('SMS')).toBe('SMS');
    expect(formatLabel('PayPal')).toBe('PayPal');
    expect(formatLabel('IPM & Pest')).toBe('IPM & Pest');
  });

  it('returns an empty string for missing values', () => {
    expect(formatLabel(undefined)).toBe('');
    expect(formatLabel(null)).toBe('');
    expect(formatLabel('  ')).toBe('');
  });
});
