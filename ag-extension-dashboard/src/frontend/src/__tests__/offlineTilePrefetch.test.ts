import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  clearTileCache,
  getTileCacheSize,
  prefetchDistrictTiles,
  tilesForBbox,
} from '@/lib/offlineTiles';

const BBOX = { minLat: -14.2, minLng: 33.5, maxLat: -13.8, maxLng: 34.0 };

function mockCacheStorage(preexisting: string[] = []) {
  const store = new Map<string, unknown>(preexisting.map(url => [url, { cached: true }]));
  const cache = {
    match: vi.fn(async (url: string) => store.get(url)),
    put: vi.fn(async (url: string, response: unknown) => {
      store.set(url, response);
    }),
    keys: vi.fn(async () => Array.from(store.keys())),
  };
  const storage = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async () => true),
  };
  vi.stubGlobal('caches', storage);
  return { storage, cache, store };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('prefetchDistrictTiles', () => {
  it('throws an actionable error when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(prefetchDistrictTiles(BBOX, undefined, 8, 8)).rejects.toThrow(
      /Cache Storage unavailable/
    );
  });

  it('downloads every tile of the bounding box into the map-tiles cache', async () => {
    const { storage, cache } = mockCacheStorage();
    const fetchMock = vi.fn(async () => ({ ok: true, clone: () => ({ copy: true }) }));
    vi.stubGlobal('fetch', fetchMock);

    // A single zoom level yields a handful of tiles — enough to prove the flow.
    const total = tilesForBbox(BBOX, 10, 10).length;
    const result = await prefetchDistrictTiles(BBOX, undefined, 10, 10);

    expect(storage.open).toHaveBeenCalledWith('map-tiles');
    expect(result).toEqual({ downloaded: total, skipped: 0, total });
    expect(fetchMock).toHaveBeenCalledTimes(total);
    expect(cache.put).toHaveBeenCalledTimes(total);
  });

  it('skips tiles already present in the cache', async () => {
    const firstTile = tilesForBbox(BBOX, 10, 10)[0];
    mockCacheStorage([firstTile.url]);
    const fetchMock = vi.fn(async () => ({ ok: true, clone: () => ({ copy: true }) }));
    vi.stubGlobal('fetch', fetchMock);

    const total = tilesForBbox(BBOX, 10, 10).length;
    const result = await prefetchDistrictTiles(BBOX, undefined, 10, 10);

    expect(result.skipped).toBe(1);
    expect(result.downloaded).toBe(total - 1);
    expect(fetchMock).toHaveBeenCalledTimes(total - 1);
  });

  it('does not count a failed tile response as downloaded', async () => {
    mockCacheStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, clone: () => ({}) }))
    );

    const result = await prefetchDistrictTiles(BBOX, undefined, 10, 10);
    expect(result.downloaded).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('keeps going when an individual tile fetch throws', async () => {
    mockCacheStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket hang up');
      })
    );

    const result = await prefetchDistrictTiles(BBOX, undefined, 10, 10);
    expect(result.downloaded).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('reports progress in batches of 25 without losing tiles', async () => {
    mockCacheStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, clone: () => ({}) }))
    );
    const onProgress = vi.fn();

    // z12 over this bbox yields more than 25 tiles, so progress fires at least once.
    const result = await prefetchDistrictTiles(BBOX, onProgress, 12, 12);

    expect(result.total).toBeGreaterThanOrEqual(25);
    expect(onProgress).toHaveBeenCalled();
    const [done, total] = onProgress.mock.calls[0];
    expect(done).toBe(25);
    expect(total).toBe(result.total);
  });
});

describe('tile cache maintenance', () => {
  it('counts cached tiles', async () => {
    mockCacheStorage(['https://tile.openstreetmap.org/10/1/1.png']);
    await expect(getTileCacheSize()).resolves.toBe(1);
  });

  it('reports zero when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(getTileCacheSize()).resolves.toBe(0);
  });

  it('deletes the tile cache for a district handover', async () => {
    const { storage } = mockCacheStorage(['a']);
    await clearTileCache();
    expect(storage.delete).toHaveBeenCalledWith('map-tiles');
  });

  it('clearing is a no-op without Cache Storage', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(clearTileCache()).resolves.toBeUndefined();
  });
});
