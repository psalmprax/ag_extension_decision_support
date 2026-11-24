import { limeCalculatorTool } from '../tools/agronomyCalculatorTool';

describe('limeCalculatorTool', () => {
  const run = async (args: Record<string, unknown>) => JSON.parse(await limeCalculatorTool.execute(limeCalculatorTool.schema.parse(args)));

  it('uses Kamprath (1970): 1.5 x exchangeable aluminium, adjusted for lime purity, and names the source', async () => {
    const result = await run({ soil_ph: 4.8, exchangeable_al_cmol: 2, cce_percentage: 80 });
    expect(result.method_source).toContain('Kamprath (1970)');
    expect(result.prescriptions.lime_tons_per_hectare).toBe(3.75); // 2 x 1.5 / 0.8
    expect(result.prescriptions.lime_kg_per_hectare).toBe(3750);
  });

  it('asks for the lab value instead of guessing lime from texture or pH', async () => {
    const result = await run({ soil_ph: 5.0 });
    expect(result.status).toBe('needs_lab_value');
    expect(result.prescriptions).toBeUndefined();
  });

  it('calls for no lime when the lab finds no exchangeable aluminium', async () => {
    const result = await run({ soil_ph: 5.9, exchangeable_al_cmol: 0 });
    expect(result.status).toBe('no_aluminium_to_neutralise');
    expect(result.prescriptions.lime_tons_per_hectare).toBe(0);
  });
});
