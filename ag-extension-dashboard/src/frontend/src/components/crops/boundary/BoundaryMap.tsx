import React, { useEffect, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BoundaryPoint } from '@ag-extension/shared/api';
import { TILE_LAYERS } from '@/components/map/mapConstants';
import type { WalkFix } from './boundaryModel';

/** Bright enough to read on satellite imagery in either theme. */
const LINE = '#34d399';
const FIX = '#fbbf24';
const WIDE_VIEW: [number, number] = [0, 30];

interface BoundaryMapProps {
  points: BoundaryPoint[];
  /** Where to open when there are no points yet: the field's saved location. */
  center: BoundaryPoint | null;
  onTap?: (point: BoundaryPoint) => void;
  /** The newest GPS fix while walking, drawn with its error circle and kept in view. */
  fix?: WalkFix | null;
  label: string;
}

function Taps({ onTap }: { onTap?: (point: BoundaryPoint) => void }) {
  useMapEvents({ click: event => onTap?.({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

/** Opens on the shape, else the field, else the person's own position, and keeps a walker in view. */
function Framing({ points, center, fix }: Pick<BoundaryMapProps, 'points' | 'center' | 'fix'>) {
  const map = useMap();
  const framed = useRef(false);

  useEffect(() => {
    // The dialog animates open; measure the map once it has its final size.
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 18 });
    } else if (center) {
      map.setView([center.lat, center.lng], 17);
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => map.setView([position.coords.latitude, position.coords.longitude], 17),
        () => undefined, // stay on the wide view; the person can pan to the field
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
      );
    }
  }, [map, points, center]);

  useEffect(() => {
    if (fix) map.panTo([fix.lat, fix.lng], { animate: true });
  }, [map, fix]);

  return null;
}

/** Satellite map of the boundary being mapped: the shape, its corners and the walker's position. */
export const BoundaryMap: React.FC<BoundaryMapProps> = ({ points, center, onTap, fix, label }) => {
  const positions = points.map(p => [p.lat, p.lng] as [number, number]);
  const satellite = TILE_LAYERS.satellite;
  return (
    <div className="h-[52dvh] min-h-[280px] w-full overflow-hidden rounded-md border border-slate-900/[0.08] dark:border-white/[0.08]" role="region" aria-label={label}>
      <MapContainer center={center ? [center.lat, center.lng] : WIDE_VIEW} zoom={center ? 17 : 4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer url={satellite.url} attribution={satellite.attribution} maxZoom={satellite.maxZoom} />
        <Taps onTap={onTap} />
        <Framing points={points} center={center} fix={fix} />
        {positions.length >= 3 && <Polygon positions={positions} pathOptions={{ color: LINE, weight: 2, fillColor: LINE, fillOpacity: 0.18 }} />}
        {positions.length === 2 && <Polyline positions={positions} pathOptions={{ color: LINE, weight: 2 }} />}
        {positions.map((position, index) => (
          <CircleMarker key={index} center={position} radius={4} pathOptions={{ color: LINE, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }} />
        ))}
        {fix && <Circle center={[fix.lat, fix.lng]} radius={fix.accuracy} pathOptions={{ color: FIX, weight: 1, fillColor: FIX, fillOpacity: 0.12 }} />}
        {fix && <CircleMarker center={[fix.lat, fix.lng]} radius={5} pathOptions={{ color: FIX, weight: 2, fillColor: FIX, fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  );
};
