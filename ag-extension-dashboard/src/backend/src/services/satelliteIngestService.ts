/**
 * Satellite imagery ingest adapter — the missing link behind satelliteNdviService.
 *
 * satelliteNdviService computes indices from caller-supplied band reflectances but
 * ingests no imagery itself. This adapter implements the provider contract
 * (bbox + date range → per-pixel bands) against the Sentinel Hub Process API, gated
 * on SENTINEL_HUB_* credentials. Without credentials it fails loudly instead of
 * letting callers silently analyze defaults.
 */
import axios from 'axios';
import { logger } from '../utils/logger';
import type { MultispectralPixel } from './satelliteNdviService';

export interface IngestRequest {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  fromDate: string; // ISO date
  toDate: string; // ISO date
  maxCloudCoverPct?: number;
}

export interface IngestResult {
  pixels: MultispectralPixel[];
  cloudCoverPct: number;
  capturedAt: string;
  source: string;
}

export interface ImageryProvider {
  fetchBands(req: IngestRequest): Promise<IngestResult>;
}

const TOKEN_URL = 'https://services.sentinel-hub.com/oauth/token';
const PROCESS_URL = 'https://services.sentinel-hub.com/api/v1/process';
const SENTINEL_DATA_SOURCE = 'sentinel-2-l2a';

/**
 * Sentinel-2 L2A reflectance bands + NDVI. Output bands are
 * [B04 red, B08 nir, B03 green, NDVI] as FLOAT32, plus the dataMask band so the
 * caller can see which pixels carried a valid observation.
 */
const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B03", "dataMask"] }],
    output: [
      { id: "bands", bands: 4, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var ndvi = (s.B08 + s.B04) === 0 ? 0 : (s.B08 - s.B04) / (s.B08 + s.B04);
  return { bands: [s.B04, s.B08, s.B03, ndvi], dataMask: [s.dataMask] };
}`;

function isConfigured(): boolean {
  return Boolean(process.env.SENTINEL_HUB_CLIENT_ID && process.env.SENTINEL_HUB_CLIENT_SECRET);
}

export function ingestStatus(): { configured: boolean; reason: string } {
  if (isConfigured()) return { configured: true, reason: 'Sentinel Hub credentials present' };
  return {
    configured: false,
    reason: 'SENTINEL_HUB_CLIENT_ID / SENTINEL_HUB_CLIENT_SECRET not set — imagery ingest unavailable; schedule manual scouting',
  };
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

async function getSentinelToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > now) return cachedToken.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SENTINEL_HUB_CLIENT_ID as string,
    client_secret: process.env.SENTINEL_HUB_CLIENT_SECRET as string,
  });

  const response = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
  });

  const token = response.data?.access_token;
  if (!token) throw new Error('Sentinel Hub token request returned no access_token');
  const expiresInSec = Number(response.data?.expires_in || 3600);
  cachedToken = { token, expiresAtMs: now + expiresInSec * 1000 };
  return token;
}

interface ProcessResponse {
  data?: number[][][];
}

/** Shape of one Process API response row: [red, nir, green, ndvi] + dataMask. */
type ProcessRow = [number, number, number, number, number?];

/** Real Sentinel Hub imagery provider (Process API). */
export const sentinelHubProvider: ImageryProvider = {
  async fetchBands(req: IngestRequest): Promise<IngestResult> {
    const token = await getSentinelToken();

    const body = {
      input: {
        bounds: {
          bbox: [req.minLng, req.minLat, req.maxLng, req.maxLat],
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
        },
        data: [
          {
            type: SENTINEL_DATA_SOURCE,
            dataFilter: {
              timeRange: {
                from: `${req.fromDate}T00:00:00Z`,
                to: `${req.toDate}T23:59:59Z`,
              },
              ...(req.maxCloudCoverPct != null
                ? { maxCloudCoverage: Math.round(req.maxCloudCoverPct) }
                : {}),
            },
          },
        ],
      },
      output: {
        width: 64,
        height: 64,
        responses: [
          { identifier: 'bands', format: { type: 'application/json' } },
          { identifier: 'dataMask', format: { type: 'application/json' } },
        ],
      },
      evalscript: NDVI_EVALSCRIPT,
    };

    const { data } = await axios.post<ProcessResponse>(PROCESS_URL, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30_000,
    });

    const rows = data?.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        'Sentinel Hub returned no observations for the requested bbox and time range — widen the window or reduce the cloud filter',
      );
    }

    const pixels: MultispectralPixel[] = [];
    let invalidPixels = 0;
    let totalPixels = 0;

    for (const rawRow of rows) {
      const row = rawRow as unknown as ProcessRow;
      if (!Array.isArray(row)) continue;
      totalPixels += 1;
      const [bandRed, bandNir, bandGreen, , dataMask] = row;
      // dataMask is 0 where the pixel has no valid observation (cloud, shadow, no
      // overpass). Only real observations become pixels — nothing is inferred.
      if (dataMask === 0 || ![bandRed, bandNir, bandGreen].every(Number.isFinite)) {
        invalidPixels += 1;
        continue;
      }
      pixels.push({ bandRed, bandNir, bandGreen });
    }

    if (pixels.length === 0) {
      throw new Error(
        'Sentinel Hub returned no cloud-free observations for the requested bbox and time range',
      );
    }

    // Share of pixels without a usable observation. This is derived from the
    // provider's dataMask, not a provider-reported cloud-cover metric.
    const invalidShare = totalPixels > 0 ? (invalidPixels / totalPixels) * 100 : 0;

    return {
      pixels,
      cloudCoverPct: Number(invalidShare.toFixed(2)),
      capturedAt: new Date().toISOString(),
      source: `${SENTINEL_DATA_SOURCE} (${req.fromDate}..${req.toDate})`,
    };
  },
};

/**
 * Env-gated Sentinel Hub fetch. Throws UNCONFIGURED when credentials are absent so
 * NDVI loops degrade to manual scouting instead of default bands. An explicit
 * provider may be injected (tests, alternate vendors).
 */
export async function ingestParcelBands(
  req: IngestRequest,
  provider?: ImageryProvider,
): Promise<IngestResult> {
  if (provider) return provider.fetchBands(req);
  const status = ingestStatus();
  if (!status.configured) {
    logger.warn(`Satellite ingest refused: ${status.reason}`);
    throw new Error(`Satellite ingest UNCONFIGURED: ${status.reason}`);
  }
  try {
    return await sentinelHubProvider.fetchBands(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Satellite ingest failed: ${message}`);
    throw new Error(`Satellite ingest FAILED: ${message}`);
  }
}
