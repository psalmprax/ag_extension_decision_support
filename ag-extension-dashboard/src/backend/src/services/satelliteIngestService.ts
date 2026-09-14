// fallow-ignore-file unused-file
/**
 * Satellite imagery ingest adapter — the missing link behind satelliteNdviService.
 *
 * satelliteNdviService computes indices from caller-supplied band reflectances
 * but ingests no imagery itself. This adapter defines the provider contract
 * (bbox + date range → per-pixel bands) and an env-gated HTTP implementation.
 * Without SENTINEL_HUB_* configured it fails loudly instead of letting
 * callers silently analyze defaults.
 */
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

/**
 * Env-gated Sentinel Hub fetch. Throws UNCONFIGURED when credentials are
 * absent so NDVI loops degrade to manual scouting instead of default bands.
 * Full OAuth + Evalscript wiring lands with provider credentials; the contract
 * and failure mode are fixed here so callers cannot invent pixels.
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
  // Credentials present but Evalscript path not yet wired: refuse rather than fake.
  throw new Error('Satellite ingest provider wiring pending — supply an ImageryProvider or complete Sentinel Hub Evalscript integration');
}
