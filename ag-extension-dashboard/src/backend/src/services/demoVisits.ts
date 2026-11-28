import fs from 'node:fs';
import { isIP } from 'node:net';
import maxmind, { type CityResponse, type Reader } from 'maxmind';
import { query } from './databaseService';
import { parseDeviceFromUserAgent } from './loginHistoryService';
import { logger } from '../utils/logger';

/**
 * Who opens the demo, roughly: when, from which country, region and city, on what kind of
 * device. No account is involved, and the full IP address is never stored: it is shortened
 * (203.0.113.x; IPv6 to its first 48 bits) and only used, in memory, to look up the city.
 *
 * The city comes from the visitor's CDN headers when the site is behind Cloudflare
 * (cf-ipcountry, cf-region, cf-ipcity), otherwise from a local copy of the free DB-IP Lite
 * city database (CC BY 4.0, "IP Geolocation by DB-IP", https://db-ip.com) that the deploy
 * downloads to GEOIP_DB_PATH. The IP is never sent to a lookup service. Without either,
 * the place is left empty rather than guessed. An IP gives an approximate place only:
 * VPNs and mobile networks often show another city.
 *
 * Rows are kept for 90 days (pruneDemoVisits).
 */

export const DEMO_VISIT_RETENTION_DAYS = 90;
const DEFAULT_DB_PATH = '/app/geoip/dbip-city-lite.mmdb';

export interface DemoVisitPlace {
  countryCode: string | null;
  region: string | null;
  city: string | null;
  source: 'cdn' | 'geoip' | null;
}

/** The eight groups of an IPv6 address, with the groups "::" leaves out written as 0. */
function expandIpv6(address: string): string[] {
  const groupsOf = (part: string): string[] =>
    part.split(':').filter(Boolean).flatMap(group => {
      if (!group.includes('.')) return [group.replace(/^0+(?=.)/, '').toLowerCase()];
      // An IPv4 tail (::ffff:1.2.3.4 or 64:ff9b::1.2.3.4) is two groups.
      const [a, b, c, d] = group.split('.').map(Number);
      return [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)];
    });
  const [head, tail] = address.split('::');
  const before = groupsOf(head);
  const after = tail === undefined ? [] : groupsOf(tail);
  return [...before, ...Array<string>(Math.max(8 - before.length - after.length, 0)).fill('0'), ...after];
}

/** 203.0.113.42 → 203.0.113.x; 2001:db8:85a3::8a2e:370:7334 → 2001:db8:85a3::/48. Null when not an IP. */
export function shortenIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const address = ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
  if (isIP(address) === 4) return address.replace(/\.\d+$/, '.x');
  if (isIP(address) === 6) return `${expandIpv6(address).slice(0, 3).join(':')}::/48`;
  return null;
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  // Cloudflare sends XX or T1 (Tor) when it does not know the country.
  if (!text || text === 'XX' || text === 'T1') return null;
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // not URL-encoded after all
  }
}

/** The place from Cloudflare's visitor-location headers, when the site is behind it. */
export function placeFromHeaders(headers: Record<string, string | string[] | undefined>): DemoVisitPlace | null {
  const countryCode = header(headers, 'cf-ipcountry');
  if (!countryCode) return null;
  return { countryCode, region: header(headers, 'cf-region'), city: header(headers, 'cf-ipcity'), source: 'cdn' };
}

let reader: Promise<Reader<CityResponse> | null> | null = null;
let releaseTimer: NodeJS.Timeout | null = null;
/** The city database is about 130 MB in memory: loaded on a demo visit, let go after 10 quiet minutes. */
const RELEASE_AFTER_MS = 10 * 60_000;

function geoDatabase(): Promise<Reader<CityResponse> | null> {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    reader = null;
    releaseTimer = null;
  }, RELEASE_AFTER_MS);
  releaseTimer.unref?.();
  if (!reader) {
    const path = process.env.GEOIP_DB_PATH || DEFAULT_DB_PATH;
    reader = fs.existsSync(path)
      ? maxmind.open<CityResponse>(path).catch(error => {
          logger.warn(`[demoVisits] City database at ${path} could not be opened; places are left empty:`, error);
          return null;
        })
      : Promise.resolve(null);
  }
  return reader;
}

/** The place from the local city database, or null when it is missing or does not know the IP. */
export async function placeFromDatabase(ip: string | null | undefined): Promise<DemoVisitPlace | null> {
  if (!ip || !isIP(ip.replace(/^::ffff:/, ''))) return null;
  const database = await geoDatabase();
  const found = database?.get(ip.replace(/^::ffff:/, ''));
  if (!found?.country?.iso_code) return null;
  return {
    countryCode: found.country.iso_code,
    region: found.subdivisions?.[0]?.names?.en ?? null,
    city: found.city?.names?.en ?? null,
    source: 'geoip',
  };
}

export async function recordDemoVisit(params: {
  ip: string | null | undefined;
  headers: Record<string, string | string[] | undefined>;
  userAgent: string | null | undefined;
}): Promise<void> {
  try {
    const place = placeFromHeaders(params.headers) ?? (await placeFromDatabase(params.ip));
    await query(
      `INSERT INTO demo_visits (country_code, region, city, ip_prefix, device, location_source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        place?.countryCode ?? null,
        place?.region?.slice(0, 120) ?? null,
        place?.city?.slice(0, 120) ?? null,
        shortenIp(params.ip),
        parseDeviceFromUserAgent(params.userAgent).slice(0, 100),
        place?.source ?? null,
      ],
    );
  } catch (error) {
    // A visit that could not be counted must never stop someone opening the demo.
    logger.warn('[demoVisits] Demo visit not recorded:', error);
  }
}

export interface DemoVisitRow {
  createdAt: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  ipPrefix: string | null;
  device: string | null;
  locationSource: string | null;
}

export async function listDemoVisits(days = 30, limit = 200): Promise<{ visits: DemoVisitRow[]; byCountry: { countryCode: string | null; visits: number }[] }> {
  const [visits, byCountry] = await Promise.all([
    query<DemoVisitRow>(
      `SELECT created_at AS "createdAt", country_code AS "countryCode", region, city, ip_prefix AS "ipPrefix",
              device, location_source AS "locationSource"
         FROM demo_visits WHERE created_at > NOW() - make_interval(days => $1)
        ORDER BY created_at DESC LIMIT $2`,
      [days, limit],
    ),
    query<{ countryCode: string | null; visits: string }>(
      `SELECT country_code AS "countryCode", COUNT(*)::text AS visits
         FROM demo_visits WHERE created_at > NOW() - make_interval(days => $1)
        GROUP BY country_code ORDER BY COUNT(*) DESC`,
      [days],
    ),
  ]);
  return { visits: visits.rows, byCountry: byCountry.rows.map(row => ({ countryCode: row.countryCode, visits: Number(row.visits) })) };
}

/** Deletes visits older than the retention period. Returns how many were deleted. */
export async function pruneDemoVisits(): Promise<number> {
  const result = await query(`DELETE FROM demo_visits WHERE created_at < NOW() - make_interval(days => $1)`, [DEMO_VISIT_RETENTION_DAYS]);
  return result.rowCount ?? 0;
}

export function __resetDemoVisitsForTests(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  reader = null;
}
