import { describe, expect, it } from 'vitest';
import { smsParts } from '@/lib/smsParts';

describe('SMS part count', () => {
  it('fits 160 plain characters in one SMS and splits at 153', () => {
    expect(smsParts('a'.repeat(160))).toEqual({ parts: 1, unicode: false });
    expect(smsParts('a'.repeat(161))).toEqual({ parts: 2, unicode: false });
    expect(smsParts('a'.repeat(306))).toEqual({ parts: 2, unicode: false });
  });

  it('counts emoji or curly quotes as UCS-2: 70, then 67 per part', () => {
    expect(smsParts(`${'a'.repeat(69)}🌽`).unicode).toBe(true);
    expect(smsParts('’'.repeat(71)).parts).toBe(2);
  });

  it('is nothing for an empty message', () => {
    expect(smsParts('')).toEqual({ parts: 0, unicode: false });
  });
});
