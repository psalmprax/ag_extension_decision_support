/**
 * Pure helpers shared by the 3D scenes. Nothing here touches WebGL, so it is
 * cheap to import and easy to unit test.
 */

export const clamp = (value: number, min = 0, max = 1): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth start and stop, for camera moves and fades. */
export const easeInOut = (t: number): number => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Deterministic pseudo-random numbers (mulberry32), so a scene looks the same on every load. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable number from a string, used to seed scenes from an id. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Smooth 2D value noise in roughly [0, 1], built on a seeded lattice. */
export function createValueNoise(seed: number): (x: number, y: number) => number {
  const rand = seededRandom(seed);
  const size = 64;
  const lattice = Array.from({ length: size * size }, () => rand());
  const at = (ix: number, iy: number) => lattice[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    const top = lerp(at(ix, iy), at(ix + 1, iy), fx);
    const bottom = lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx);
    return lerp(top, bottom, fy);
  };
}

/** Two octaves of value noise, for terrain that is gentle but not uniform. */
export function fractalNoise(noise: (x: number, y: number) => number, x: number, y: number): number {
  return noise(x, y) * 0.7 + noise(x * 2.3 + 17, y * 2.3 + 31) * 0.3;
}

/**
 * A point on a sphere for a latitude and longitude in degrees. Longitude 0 faces +X,
 * matching three.js SphereGeometry UVs on an equirectangular texture (left edge = longitude -180).
 */
export function latLonToVector(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Crop canopy colour for an NDVI reading: green when dense, olive then straw as it thins. */
export function canopyColorForNdvi(ndvi: number | null | undefined): string {
  if (ndvi === null || ndvi === undefined || !Number.isFinite(ndvi)) return '#5f8a5a';
  if (ndvi >= 0.6) return '#3f8a4c';
  if (ndvi >= 0.45) return '#6a9a45';
  if (ndvi >= 0.3) return '#a39a43';
  return '#b8935a';
}

/** Parses a coordinate that may arrive as a string; null when it is not a usable number. */
export function toCoordinate(value: string | number | null | undefined, limit: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
