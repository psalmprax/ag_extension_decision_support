import { z } from 'zod';
import { Tool } from './types';

const limeSchema = z.object({
  soil_ph: z.number().min(3.0).max(9.0).describe('Current soil pH from the soil test (e.g. 4.8)'),
  exchangeable_al_cmol: z.number().min(0).max(20).optional().describe('Exchangeable aluminium (KCl-extractable Al3+) from the soil lab, in cmol(+)/kg or meq/100 g'),
  cce_percentage: z.number().min(50).max(110).optional().default(100).describe('Calcium carbonate equivalent (purity) of the lime, from its bag or supplier; 100 for pure CaCO3'),
});

/** The one method this tool uses, so every answer can name it. */
const KAMPRATH_1970 =
  'Kamprath (1970), Exchangeable aluminum as a criterion for liming leached mineral soils, Soil Science Society of America Proceedings 34: 252-254';
/** Kamprath's factor: lime (t CaCO3/ha, top ~20 cm) = 1.5 × exchangeable Al (cmol/kg). */
const KAMPRATH_FACTOR = 1.5;

/**
 * Lime to neutralise exchangeable aluminium on acid, highly weathered soils, by Kamprath's
 * method. It needs the lab's exchangeable-aluminium value: without one it says so rather than
 * estimating lime from soil texture, which has no source here.
 */
export const limeCalculatorTool: Tool<typeof limeSchema> = {
  name: 'calculate_lime_requirement',
  description:
    'Lime (CaCO3) needed to neutralise exchangeable aluminium on acid tropical soils, by Kamprath (1970): 1.5 x exchangeable Al. Needs the exchangeable aluminium value from a soil lab.',
  schema: limeSchema,
  execute: async args => {
    const { soil_ph, exchangeable_al_cmol, cce_percentage } = args;

    if (exchangeable_al_cmol === undefined) {
      return JSON.stringify({
        soil_ph,
        status: 'needs_lab_value',
        message:
          'This calculation needs exchangeable aluminium from a soil lab (or the lab\'s own buffer-pH lime requirement). It does not estimate lime from pH or texture alone. Ask the lab for exchangeable Al, or use the lime rate on the soil test report.',
        method_source: KAMPRATH_1970,
      }, null, 2);
    }

    if (exchangeable_al_cmol === 0) {
      return JSON.stringify({
        soil_ph,
        status: 'no_aluminium_to_neutralise',
        prescriptions: { lime_tons_per_hectare: 0, lime_kg_per_hectare: 0, lime_kg_per_acre: 0, bags_50kg_per_acre: 0 },
        message: 'The lab found no exchangeable aluminium, so this method calls for no lime. A crop that needs a higher pH may still need lime; follow the soil test report.',
        method_source: KAMPRATH_1970,
      }, null, 2);
    }

    // Lime with less than 100% calcium carbonate equivalent is needed in proportionally larger amounts.
    const cceFactor = 100 / Math.max(50, cce_percentage);
    const limeTonsHa = Math.round(exchangeable_al_cmol * KAMPRATH_FACTOR * cceFactor * 100) / 100;
    const kgPerHa = Math.round(limeTonsHa * 1000);
    const kgPerAcre = Math.round(kgPerHa / 2.47105);

    return JSON.stringify({
      soil_ph,
      exchangeable_al_cmol,
      method_used: `Kamprath aluminium neutralisation: ${KAMPRATH_FACTOR} x exchangeable Al, adjusted for ${cce_percentage}% CCE`,
      method_source: KAMPRATH_1970,
      cce_purity_percent: cce_percentage,
      prescriptions: {
        lime_tons_per_hectare: limeTonsHa,
        lime_kg_per_hectare: kgPerHa,
        lime_kg_per_acre: kgPerAcre,
        bags_50kg_per_acre: Math.round((kgPerAcre / 50) * 10) / 10,
      },
      application_guidance: [
        'The rate is for working the lime into the top soil layer (about 20 cm), as in the original method; spread it evenly and mix it in.',
        'Apply it before planting, when the soil is moist, so it has time to react.',
        'If the soil test shows low magnesium, dolomitic lime supplies magnesium as well as calcium.',
        'Some crops tolerate aluminium better than others; the soil lab or your national guide may adjust the rate for the crop.',
      ],
    }, null, 2);
  },
};
