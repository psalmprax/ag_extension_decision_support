import { speechText, spokenAmount, withoutMarkup } from '@/shared-api/speechText';

describe('text prepared for a voice', () => {
  it('says rates and amounts in words in the answer language, keeping the number as written', () => {
    expect(speechText('Spray 2.5 L/ha at dawn.', 'en')).toBe('Spray 2.5 liters per hectare at dawn.');
    expect(speechText('Appliquez 2,5 L/ha.', 'fr')).toBe('Appliquez 2,5 litres par hectare.');
    expect(speechText('Weka 50 kg/ha.', 'sw')).toBe('Weka kilogramu 50 kwa kila hekta.');
    expect(speechText('Mix 20 ml/L and keep it under 30°C.', 'en')).toBe('Mix 20 milliliters per liter and keep it under 30 degrees Celsius.');
    expect(speechText('Aplique 1.250 kg/ha.', 'pt')).toBe('Aplique 1.250 quilogramas por hectare.');
  });

  it('chooses singular or plural from the number', () => {
    expect(spokenAmount('1', 'ha', undefined, 'en')).toBe('1 hectare');
    expect(spokenAmount('1,250', 'kg', 'ha', 'en')).toBe('1,250 kilograms per hectare');
  });

  it('leaves the unit as written where the language has no spoken unit names, rather than use English', () => {
    expect(speechText('Fi 2.5 L/ha si oko.', 'yo')).toBe('Fi 2.5 L/ha si oko.');
    expect(speechText('Ikani 50 kg/ha.', 'ny')).toBe('Ikani 50 kg/ha.');
  });

  it('reads a fertiliser grade as three numbers, not a time or a subtraction', () => {
    expect(speechText('Top-dress with NPK 23:10:5 or NPK 17-17-17.', 'en')).toBe('Top-dress with NPK 23, 10, 5 or NPK 17, 17, 17.');
  });

  it('removes markdown, links and source markers', () => {
    expect(withoutMarkup('**Scout weekly** [2]. See [the guide](https://example.org) [1, 3].\n- Remove eggs')).toBe(
      'Scout weekly. See the guide. Remove eggs',
    );
  });

  it('does not touch words that only start like a unit', () => {
    expect(speechText('Wait 2 months, then plant 3 hand-spaced rows.', 'en')).toBe('Wait 2 months, then plant 3 hand-spaced rows.');
  });
});
