import { describe, it, expect } from 'vitest';
import { dosagePreviewText } from '@/pages/advisoryStudio/dosagePreview';

describe('Advisory Studio dosage preview', () => {
  it('repeats the configured rate, so editing the step changes the preview', () => {
    expect(dosagePreviewText({ rateLitersPerAcre: 0.4, waterPerAcreLiters: 133 }, false)).toBe('Apply 0.4 L per acre in 133 L of water.');
    expect(dosagePreviewText({ rateLitersPerAcre: 0.25, waterPerAcreLiters: 100 }, false)).toBe('Apply 0.25 L per acre in 100 L of water.');
  });

  it('never invents a rate', () => {
    expect(dosagePreviewText({}, false)).toBe('No application rate configured for this step.');
    expect(dosagePreviewText({ rateLitersPerAcre: 0.4 }, true)).toMatch(/soil test/);
    expect(dosagePreviewText({ rateLitersPerAcre: 0.4 }, true)).not.toMatch(/\d/);
  });
});
