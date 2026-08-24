/**
 * Offline map tile prefetch — lets officers download all tiles for a bounding
 * box (their assigned district) before going off-grid. Tiles are stored in the
 * same 'map-tiles' Cache Storage the PWA service worker reads at runtime, so
 * cached tiles are served transparently by the existing CacheFirst handler.
 */

const TILE_CACHE = 'map-tiles';
const OSM_TILE = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** lng/lon → global pixel coords at zoom z (slippy map tiling scheme). */
const lngToX = (lng: number, z: number): number => ((lng + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number): number => {
    const rad = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};

export interface TileSpec {
    z: number;
    x: number;
    y: number;
    url: string;
}

/** Pure function: all tiles covering a bbox between minZoom..maxZoom. */
export function tilesForBbox(
    bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
    minZoom = 8,
    maxZoom = 14
): TileSpec[] {
    const tiles: TileSpec[] = [];
    for (let z = minZoom; z <= maxZoom; z++) {
        const x0 = Math.floor(lngToX(Math.min(bbox.minLng, bbox.maxLng), z));
        const x1 = Math.floor(lngToX(Math.max(bbox.minLng, bbox.maxLng), z));
        const y0 = Math.floor(latToY(Math.max(bbox.minLat, bbox.maxLat), z));
        const y1 = Math.floor(latToY(Math.min(bbox.minLat, bbox.maxLat), z));
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                tiles.push({ z, x, y, url: OSM_TILE(z, x, y) });
            }
        }
    }
    return tiles;
}

/** Rough download estimate so users can confirm before fetching. */
export function estimateDownload(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }, minZoom = 8, maxZoom = 14): { tiles: number; approxKb: number } {
    const tiles = tilesForBbox(bbox, minZoom, maxZoom).length;
    return { tiles, approxKb: tiles * 18 }; // ~18KB average OSM tile
}

async function withConcurrency(items: TileSpec[], worker: (t: TileSpec) => Promise<void>, limit = 6, onProgress?: (done: number, total: number) => void): Promise<void> {
    let done = 0;
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const item = items[index++];
            await worker(item);
            done += 1;
            if (onProgress && done % 25 === 0) onProgress(done, items.length);
        }
    });
    await Promise.all(runners);
}

/**
 * Downloads every tile for a bbox into the PWA 'map-tiles' cache.
 * Skips tiles already cached; returns counts.
 */
export async function prefetchDistrictTiles(
    bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
    onProgress?: (done: number, total: number) => void,
    minZoom = 8,
    maxZoom = 14
): Promise<{ downloaded: number; skipped: number; total: number }> {
    if (typeof caches === 'undefined') throw new Error('Cache Storage unavailable — offline maps require HTTPS or a build with PWA enabled');
    const cache = await caches.open(TILE_CACHE);
    const tiles = tilesForBbox(bbox, minZoom, maxZoom);
    let downloaded = 0;
    let skipped = 0;

    await withConcurrency(
        tiles,
        async tile => {
            const cached = await cache.match(tile.url);
            if (cached) {
                skipped += 1;
                return;
            }
            try {
                const response = await fetch(tile.url, { cache: 'force-cache' });
                if (response.ok) {
                    await cache.put(tile.url, response.clone());
                    downloaded += 1;
                }
            } catch {
                // individual tile failure is non-fatal
            }
        },
        6,
        onProgress
    );

    return { downloaded, skipped, total: tiles.length };
}

export async function getTileCacheSize(): Promise<number> {
    if (typeof caches === 'undefined') return 0;
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    return keys.length;
}

export async function clearTileCache(): Promise<void> {
    if (typeof caches === 'undefined') return;
    await caches.delete(TILE_CACHE);
}
