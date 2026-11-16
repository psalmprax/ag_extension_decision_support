/**
 * What the field-officer preview says for a dosage step. It only repeats the
 * values configured on the canvas, so editing a rate changes the preview. It
 * never supplies a rate of its own: liming needs the farm's soil test, so the
 * lime branch says so instead of showing a fixed tonnage.
 */
export function dosagePreviewText(config: Record<string, unknown>, isLime: boolean): string {
  if (isLime) return 'Lime rate: set from this farm\'s soil test (no rate configured in this protocol).';
  const rate = config.rateLitersPerAcre;
  const water = config.waterPerAcreLiters;
  if (rate === undefined || rate === null || rate === '') return 'No application rate configured for this step.';
  return `Apply ${String(rate)} L per acre${water ? ` in ${String(water)} L of water` : ''}.`;
}
