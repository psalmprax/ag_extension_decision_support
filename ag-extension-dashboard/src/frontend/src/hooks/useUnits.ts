import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { areaFromHectares, areaToHectares, areaUnitFor, formatArea, formatTemp, tempUnitFor } from '@/lib/units';

/**
 * The signed-in person's display units: land in hectares or acres and temperature in
 * °C or °F, from their saved choice or their country. Values are stored in hectares
 * and Celsius; convert only for showing and reading input.
 */
export function useUnits() {
  const user = useAppStore(state => state.user);
  const settings = user?.profileSettings;
  const country = user?.country;
  return useMemo(() => {
    const areaUnit = areaUnitFor(settings, country);
    const tempUnit = tempUnitFor(settings, country);
    return {
      areaUnit,
      tempUnit,
      /** "ha" or "acres", for input labels. */
      areaLabel: areaUnit === 'ha' ? 'hectares' : 'acres',
      area: (hectares: number | string | null | undefined, digits = 1) => formatArea(hectares, areaUnit, digits),
      temp: (celsius: number | string | null | undefined) => formatTemp(celsius, tempUnit),
      /** From the person's unit to hectares (for saving). */
      toHectares: (value: number) => areaToHectares(value, areaUnit),
      /** From hectares to the person's unit (for filling an input). */
      fromHectares: (hectares: number) => areaFromHectares(hectares, areaUnit),
    };
  }, [settings, country]);
}
