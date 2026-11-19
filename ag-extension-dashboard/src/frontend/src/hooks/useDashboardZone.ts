import { useMemo } from 'react';
import { create } from 'zustand';
import type { Farmer } from '@/types/dashboard';

/** The zone (village, else district) the dashboard is focused on; '' = all. */
export const useDashboardZone = create<{ zone: string; setZone: (zone: string) => void }>(set => ({
  zone: '',
  setZone: zone => set({ zone }),
}));

export function zoneOf(farmer: Farmer): string {
  return (farmer.village || farmer.district || '').trim();
}

/** The farmers in the selected zone (all of them when no zone is selected). */
export function useZoneFarmers(farmers: Farmer[]): Farmer[] {
  const zone = useDashboardZone(state => state.zone);
  return useMemo(() => (zone ? farmers.filter(f => zoneOf(f) === zone) : farmers), [farmers, zone]);
}
