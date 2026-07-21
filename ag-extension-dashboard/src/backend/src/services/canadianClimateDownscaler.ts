import { logger } from '../utils/logger';

export type CanadianAgroZone =
  | 'prairie_drylands'
  | 'eastern_continental'
  | 'pacific_maritime'
  | 'boreal_fringe';

export interface AgroClimateAssessment {
  zone: CanadianAgroZone;
  frostRiskLevel: 'low' | 'moderate' | 'severe';
  droughtIndexScore: number; // 0 (wet) to 100 (extreme drought)
  growingDegreeDaysAccumulated: number;
  recommendedAdaptations: string[];
}

export class CanadianClimateDownscaler {
  /**
   * Assesses localized climate risk for Canadian agro-climatic zones
   */
  public static assessZoneRisk(
    zone: CanadianAgroZone,
    temperatureCelsius: number,
    consecutiveDryDays: number
  ): AgroClimateAssessment {
    logger.info(`Evaluating Canadian Climate Downscaler for Zone: ${zone}`);

    const adaptations: string[] = [];
    let frostRiskLevel: AgroClimateAssessment['frostRiskLevel'] = 'low';

    if (temperatureCelsius < 2) {
      frostRiskLevel = 'severe';
      adaptations.push('Deploy crop canopy frost protection blankets.');
      adaptations.push('Delay seeding for tender spring crops until soil reaches 8°C.');
    } else if (temperatureCelsius < 6) {
      frostRiskLevel = 'moderate';
    }

    const droughtIndexScore = Math.min(100, consecutiveDryDays * 3.5);

    if (zone === 'prairie_drylands') {
      if (consecutiveDryDays > 14) {
        adaptations.push('Switch to drought-tolerant pulse/canola cultivars.');
        adaptations.push('Implement zero-till residue retention to conserve soil moisture.');
      }
    } else if (zone === 'eastern_continental') {
      if (consecutiveDryDays < 3) {
        adaptations.push('Monitor for Phytophthora root rot in waterlogged fields.');
      }
    }

    return {
      zone,
      frostRiskLevel,
      droughtIndexScore,
      growingDegreeDaysAccumulated: 1450,
      recommendedAdaptations: adaptations,
    };
  }
}
