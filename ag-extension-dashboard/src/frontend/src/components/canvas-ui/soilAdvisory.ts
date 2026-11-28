export interface SoilAdvisory {
  status: 'optimal' | 'warning' | 'critical';
  recommendation: string;
}

/**
 * The status and advice for a soil value against its target range (both ends included).
 * Outside the range is something to check, not an emergency: the heatmap is interpolated
 * (and in the demo, sample data), so a lab test decides what to do.
 */
export function soilAdvisory(value: number, [optMin, optMax]: [number, number], unit: string): SoilAdvisory {
  if (value >= optMin && value <= optMax) {
    return { status: 'optimal', recommendation: 'Soil parameter in healthy target range for standard crop cycle.' };
  }
  return {
    status: 'warning',
    recommendation: `${value < optMin ? 'Below' : 'Above'} the ${optMin}–${optMax} ${unit} target range. Confirm with a lab soil test before acting.`,
  };
}
