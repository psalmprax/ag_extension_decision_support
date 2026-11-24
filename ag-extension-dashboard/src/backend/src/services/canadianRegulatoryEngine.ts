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

const PMRA_LABEL_SEARCH = 'https://www.canada.ca/en/health-canada/services/consumer-product-safety/pesticides-pest-management/registrants-applicants/tools/pesticide-label-search.html';

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

    // Actives with no remaining registration in Canada (PMRA cancelled or phased them out). The
    // app holds no copy of the label register, so anything else is left to the label search.
    const prohibitedIngredients = ['ddt', 'endosulfan', 'lindane'];
    if (prohibitedIngredients.includes(activeIngredient.toLowerCase())) {
      isCompliant = false;
      registrationStatus = 'prohibited';
      warnings.push(`PROHIBITED: ${activeIngredient} has no registration under the Pest Control Products Act.`);
    }
    warnings.push(
      `Check the rate (${dosagePerHectare} per hectare), crop, buffer zone and re-entry interval on the product label: ${PMRA_LABEL_SEARCH}. Provincial rules in ${province} may add to them.`
    );

    return {
      isCompliant,
      actName: 'Pest Control Products Act (Canada)',
      registrationStatus,
      warnings,
      sourceNote:
        'Only a short list of actives with no Canadian registration is held here. Rates, buffer zones and registration status come from the product label, not from this check.',
    };
  }
}
