/**
 * The globe's surface: country shapes from Natural Earth (world-atlas, 1:110m), drawn into
 * an equirectangular canvas that wraps the sphere. Drawn once per theme.
 */
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesUrl from 'world-atlas/countries-110m.json?url';

export interface GlobePalette {
  ocean: string;
  land: string;
  border: string;
  graticule: string;
}

export const GLOBE_PALETTES: Record<'dark' | 'light', GlobePalette> = {
  dark: { ocean: '#0b2530', land: '#355440', border: 'rgba(230,238,233,0.32)', graticule: 'rgba(230,238,233,0.07)' },
  light: { ocean: '#9fc0ca', land: '#e8e4d6', border: 'rgba(31,45,38,0.45)', graticule: 'rgba(255,255,255,0.35)' },
};

let topologyPromise: Promise<Topology> | null = null;
const loadTopology = () => (topologyPromise ??= fetch(countriesUrl).then(response => response.json() as Promise<Topology>));

export async function drawGlobeTexture(palette: GlobePalette, width = 4096): Promise<HTMLCanvasElement> {
  const topology = await loadTopology();
  const countries = topology.objects.countries as GeometryCollection;
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const projection = geoEquirectangular().fitExtent([[0, 0], [width, height]], { type: 'Sphere' });
  const path = geoPath(projection, context);

  context.fillStyle = palette.ocean;
  context.fillRect(0, 0, width, height);
  context.beginPath();
  path(geoGraticule10());
  context.strokeStyle = palette.graticule;
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  path(feature(topology, countries));
  context.fillStyle = palette.land;
  context.fill();
  context.beginPath();
  path(mesh(topology, countries, (a, b) => a !== b));
  context.strokeStyle = palette.border;
  context.lineWidth = 1.6;
  context.stroke();
  return canvas;
}
