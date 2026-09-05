import { limeCalculatorTool } from '../tools/agronomyCalculatorTool';

describe('agronomyCalculatorTool (Deterministic Lime Titration)', () => {
  it('calculates correct lime requirement using Kamprath equation for acidic soils with exchangeable aluminum', async () => {
    const resultJson = await limeCalculatorTool.execute({
      soil_ph: 4.8,
      target_ph: 6.2,
      exchangeable_al_cmol: 1.8,
      soil_texture: 'loam',
      cce_percentage: 85,
      crop: 'maize',
    });

    const result = JSON.parse(resultJson);
    expect(result.soil_ph).toBe(4.8);
    expect(result.target_ph).toBe(6.2);
    expect(result.method_used).toContain('Kamprath');
    // Kamprath: 1.8 * 1.5 * (100 / 85) = 2.7 * 1.176 = ~3.18 tons/ha
    expect(result.prescriptions.lime_tons_per_hectare).toBeCloseTo(3.18, 1);
    expect(result.prescriptions.lime_kg_per_acre).toBeGreaterThan(1200);
    expect(result.prescriptions.bags_50kg_per_acre).toBeGreaterThan(20);
    expect(result.application_guidance).toHaveLength(4);
  });

  it('calculates buffer deficit method when exchangeable aluminum is omitted', async () => {
    const resultJson = await limeCalculatorTool.execute({
      soil_ph: 5.0,
      target_ph: 6.0,
      soil_texture: 'clay',
      cce_percentage: 90,
      crop: 'sorghum',
    });

    const result = JSON.parse(resultJson);
    expect(result.method_used).toContain('Buffer-Capacity Deficit Method');
    // Deficit: 1.0 * 3.8 * (100 / 90) = ~4.22 tons/ha
    expect(result.prescriptions.lime_tons_per_hectare).toBeCloseTo(4.22, 1);
    expect(result.prescriptions.bags_50kg_per_acre).toBeGreaterThan(30);
  });

  it('returns 0 lime required when soil pH is already at or above target', async () => {
    const resultJson = await limeCalculatorTool.execute({
      soil_ph: 6.5,
      target_ph: 6.2,
      soil_texture: 'loam',
      crop: 'maize',
      cce_percentage: 85,
    });

    const result = JSON.parse(resultJson);
    expect(result.status).toBe('Optimal / No Liming Required');
    expect(result.prescriptions?.lime_tons_per_hectare || result.lime_required_tons_per_ha).toBe(0);
  });
});
