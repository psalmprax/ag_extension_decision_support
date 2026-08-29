import { logger } from '../utils/logger';

export interface RegulatoryCheckResult {
  isCompliant: boolean;
  actName: string;
  registrationStatus: 'registered' | 'restricted' | 'prohibited' | 'requires_permit';
  maximumDosagePerHectare?: number;
  bufferZoneMeters?: number;
  warnings: string[];
  /** Honest scope note: this is a bounded rule set, not a full PMRA/CFIA registry lookup. */
  sourceNote: string;
}

export class CanadianRegulatoryEngine {
  /**
   * Validates agronomic treatments against Canadian Federal & Provincial regulations
   */
  public static validateTreatment(
    treatmentName: string,
    activeIngredient: string,
    province: string,
    dosagePerHectare: number
  ): RegulatoryCheckResult {
    logger.info(`Running Canadian Regulatory Check: ${treatmentName} (${province})`);

    const warnings: string[] = [];
    let isCompliant = true;
    let registrationStatus: RegulatoryCheckResult['registrationStatus'] = 'registered';

    // PMRA Pest Control Products Act (PCPA) Check
    const restrictedActiveIngredients = ['neonicotinoids', 'glyphosate_aquatic_buffer', 'dicamba_high_volatility'];
    const prohibitedIngredients = ['DDT', 'endosulfan', 'lindane'];

    if (prohibitedIngredients.includes(activeIngredient.toLowerCase())) {
      isCompliant = false;
      registrationStatus = 'prohibited';
      warnings.push(`PROHIBITED: ${activeIngredient} is banned under the Pest Control Products Act (PCPA).`);
    } else if (restrictedActiveIngredients.includes(activeIngredient.toLowerCase())) {
      registrationStatus = 'restricted';
      warnings.push(`RESTRICTED: ${activeIngredient} requires certified applicator license in ${province}.`);
    }

    // CFIA Fertilizers Act max application check
    if (dosagePerHectare > 250) {
      warnings.push(`EXCEEDS THRESHOLD: Dosage ${dosagePerHectare}kg/ha exceeds CFIA Fertilizers Act environmental runoff guidelines.`);
      if (dosagePerHectare > 400) isCompliant = false;
    }

    // Provincial aquatic buffer zone enforcement (e.g. Ontario O. Reg 63/09, Prairie Water Protection)
    const bufferZoneMeters = province.toLowerCase() === 'ontario' || province.toLowerCase() === 'quebec' ? 15 : 10;

    return {
      isCompliant,
      actName: 'Canada Pest Control Products Act & Fertilizers Act',
      registrationStatus,
      maximumDosagePerHectare: 250,
      bufferZoneMeters,
      warnings,
      sourceNote:
        'Bounded offline rule set (limited ingredient list + fixed thresholds). Not a substitute for a current PMRA/CFIA label or product-registry lookup.',
    };
  }
}
