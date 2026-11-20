import { useEffect } from 'react';
import type L from 'leaflet';
import type { FarmerData } from './mapConstants';

interface MapViewSetters {
  setMapBounds: (bounds: L.LatLngBoundsExpression | undefined) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
}

/**
 * Frames the plotted farms whenever the set of farmers changes, so pins are
 * not left as one cluster on a country-wide view. One farm centres on it.
 */
export function useFrameFarmers(farmers: FarmerData[], { setMapBounds, setMapCenter, setMapZoom }: MapViewSetters): void {
  const key = farmers.map(f => `${f.id}:${f.lat}:${f.lng}`).join('|');
  useEffect(() => {
    if (farmers.length === 0) return;
    if (farmers.length === 1) {
      setMapBounds(undefined);
      setMapCenter([farmers[0].lat, farmers[0].lng]);
      setMapZoom(11);
      return;
    }
    setMapBounds(farmers.map(f => [f.lat, f.lng] as [number, number]));
    // `key` stands in for the farmers array, which callers rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
