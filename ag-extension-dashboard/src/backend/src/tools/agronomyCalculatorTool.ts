import { z } from 'zod';
import { Tool } from './types';

const limeSchema = z.object({
  soil_ph: z.number().min(3.0).max(9.0).describe('Current soil pH measurement (e.g. 4.8)'),
  target_ph: z.number().min(5.0).max(7.5).optional().default(6.2).describe('Target soil pH (default 6.2 for most field crops)'),
  exchangeable_al_cmol: z.number().min(0).max(20).optional().describe('Exchangeable Aluminum Al3+ in cmol(+)/kg or meq/100g (Kamprath method)'),
  effective_cec_cmol: z.number().min(0).max(100).optional().describe('Effective Cation Exchange Capacity (ECEC) in cmol/kg'),
  soil_texture: z.enum(['sandy', 'loam', 'clay', 'organic']).optional().default('loam').describe('Soil textural class for buffering capacity factor'),
  cce_percentage: z.number().min(50).max(110).optional().default(85).describe('Calcium Carbonate Equivalent (CCE) purity % of agricultural lime (default 85%)'),
  crop: z.string().optional().default('maize').describe('Target crop name to determine aluminum tolerance factor'),
});

export const limeCalculatorTool: Tool<typeof limeSchema> = {
  name: 'calculate_lime_requirement',
  description: 'Deterministic scientific calculator for agricultural lime (CaCO3) requirement on acidic soils using the Kamprath aluminum-neutralization and buffer-capacity equations.',
  schema: limeSchema,
  execute: async (args) => {
    const { soil_ph, target_ph, exchangeable_al_cmol, soil_texture, cce_percentage, crop } = args;

    if (soil_ph >= target_ph) {
      return JSON.stringify({
        soil_ph,
        target_ph,
        status: 'Optimal / No Liming Required',
        lime_required_tons_per_ha: 0,
        lime_required_kg_per_acre: 0,
        bags_50kg_per_acre: 0,
        scientific_rationale: `Soil pH (${soil_ph}) is at or above target pH (${target_ph}). Aluminum toxicity is negligible above pH 5.5. Maintain organic matter and monitor annually.`,
      }, null, 2);
    }

    const cceFactor = 100 / Math.max(50, cce_percentage);
    let baseLimeTonsHa = 0;
    let methodUsed = '';

    // Crop sensitivity multiplier for Kamprath equation
    const lowerCrop = crop.toLowerCase();
    const isSensitive = ['bean', 'soybean', 'alfalfa', 'wheat', 'pea', 'clover', 'legume'].some(c => lowerCrop.includes(c));
    const isTolerant = ['cassava', 'tea', 'potato', 'pineapple', 'coffee', 'sweet potato'].some(c => lowerCrop.includes(c));
    const cropMultiplier = isSensitive ? 2.0 : isTolerant ? 1.2 : 1.5; // Maize/standard default: 1.5

    if (exchangeable_al_cmol !== undefined && exchangeable_al_cmol > 0) {
      // Kamprath equation: Lime (tons CaCO3/ha) = Multiplier * Exch Al (cmol/kg)
      baseLimeTonsHa = exchangeable_al_cmol * cropMultiplier;
      methodUsed = `Kamprath Aluminum-Neutralization Equation (${cropMultiplier}x multiplier for ${crop})`;
    } else {
      // Buffer deficit method based on soil texture
      const textureBufferFactors: Record<string, number> = {
        sandy: 1.5,
        loam: 2.5,
        clay: 3.8,
        organic: 4.5,
      };
      const bufferFactor = textureBufferFactors[soil_texture] || 2.5;
      const phDeficit = target_ph - soil_ph;
      baseLimeTonsHa = phDeficit * bufferFactor;
      methodUsed = `Buffer-Capacity Deficit Method (${bufferFactor} tons/ha per unit pH deficit for ${soil_texture} soil)`;
    }

    // Apply CCE purity adjustment
    const actualLimeTonsHa = Math.round(baseLimeTonsHa * cceFactor * 100) / 100;
    const kgPerHa = Math.round(actualLimeTonsHa * 1000);
    const kgPerAcre = Math.round(kgPerHa / 2.47105);
    const bags50kgPerAcre = Math.round((kgPerAcre / 50) * 10) / 10;

    return JSON.stringify({
      soil_ph,
      target_ph,
      method_used: methodUsed,
      cce_purity_percent: cce_percentage,
      prescriptions: {
        lime_tons_per_hectare: actualLimeTonsHa,
        lime_kg_per_hectare: kgPerHa,
        lime_kg_per_acre: kgPerAcre,
        bags_50kg_per_acre: bags50kgPerAcre,
      },
      application_guidance: [
        'Broadcast uniformly and incorporate into the plow layer (0-15 to 0-20 cm) using disc harrow or hoeing.',
        'Apply 4 to 8 weeks prior to planting; moisture is essential for the acid-neutralizing reaction (CaCO3 + 2H+ -> Ca2+ + H2O + CO2).',
        'If single application exceeds 4 tons/ha (1.6 tons/acre), split into two seasonal applications to avoid micro-nutrient zinc/boron tie-up.',
        'Do not apply simultaneously with ammonium-based nitrogen fertilizers (e.g. DAP, Urea) to prevent ammonia gas volatilization loss.'
      ],
      economic_note: 'Calcific lime (CaCO3) provides calcium; if magnesium is also deficient (Mg < 0.5 cmol/kg), substitute with dolomitic limestone (CaCO3.MgCO3).'
    }, null, 2);
  }
};
