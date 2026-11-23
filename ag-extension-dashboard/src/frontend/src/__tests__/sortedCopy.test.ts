import { describe, expect, it, vi } from 'vitest';
import { sortedCopy } from '@/lib/sortedCopy';
import { mergeHistorySeries } from '@/components/market/marketPriceModel';

describe('sortedCopy', () => {
  it('uses the native method without mutating the input', () => {
    const items = [3, 1, 2];
    const native = vi.spyOn(items, 'toSorted');
    try {
      expect(sortedCopy(items, (a, b) => a - b)).toEqual([1, 2, 3]);
      expect(native).toHaveBeenCalledOnce();
      expect(items).toEqual([3, 1, 2]);
    } finally {
      native.mockRestore();
    }
  });

  it('sorts a copy when the native method is unavailable', () => {
    const items = [3, 1, 2];
    Object.defineProperty(items, 'toSorted', { value: undefined });
    expect(sortedCopy(items, (a, b) => a - b)).toEqual([1, 2, 3]);
    expect(items).toEqual([3, 1, 2]);
  });
});

describe('mergeHistorySeries', () => {
  it('sorts crops and dates without changing the source order', () => {
    const history = [
      { crop: 'Maize', currency: 'KES', source: 'market', series: [{ date: '2026-01-02', price: 2 }] },
      { crop: 'Beans', currency: 'KES', source: 'market', series: [{ date: '2026-01-01', price: 1 }] },
    ];
    const result = mergeHistorySeries(history);
    expect(result.series.map(item => item.crop)).toEqual(['Beans', 'Maize']);
    expect(result.merged).toEqual([
      { date: '2026-01-01', Beans: 1 },
      { date: '2026-01-02', Maize: 2 },
    ]);
    expect(history.map(item => item.crop)).toEqual(['Maize', 'Beans']);
    expect(mergeHistorySeries()).toEqual({ series: [], merged: [] });
  });
});
