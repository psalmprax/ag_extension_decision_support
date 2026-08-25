import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface MapControllerProps {
  center?: [number, number];
  zoom?: number;
  bounds?: L.LatLngBoundsExpression;
}

export function MapController({ center, zoom, bounds }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    const container = map.getContainer();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && container) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (center && zoom !== undefined) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, bounds]);

  return null;
}
