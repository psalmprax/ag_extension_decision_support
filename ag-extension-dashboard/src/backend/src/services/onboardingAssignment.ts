/**
 * Placing a farmer who joined by SMS, WhatsApp or Telegram: the farm size they typed, and
 * the officer who already works where they farm.
 */
import type { PoolClient } from 'pg';
import { query } from './databaseService';

const ACRE_IN_HECTARES = 0.404686;

/** Hectares from "2.5", "2.5 ha" or "5 acres"; null when no number was given. */
export function parseFarmSize(text: string): number | null {
    const match = /(\d+(?:[.,]\d+)?)\s*(ha|hectares?|hekta|ac|acres?|ekari)?/i.exec(text);
    if (!match) return null;
    const value = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || value > 10_000) return null;
    const unit = (match[2] ?? '').toLowerCase();
    const hectares = /^(ac|acre|acres|ekari)$/.test(unit) ? value * ACRE_IN_HECTARES : value;
    return Math.round(hectares * 100) / 100;
}

export interface PlacedOfficer {
    officerId: string;
    region: string | null;
    tenantId: string | null;
}

/**
 * The least busy active officer who already advises farmers in the place the farmer typed
 * (county, district, village or region), or whose own region it is. Null when nobody does:
 * the farmer then waits, unassigned, for a manager to place them. With no tenant given (a
 * number texting the shared short code), officers in every organisation are considered and
 * the farmer joins the organisation of the officer found.
 */
export async function officerForPlace(place: string, tenantId: string | null, client?: PoolClient): Promise<PlacedOfficer | null> {
    const text = place.trim();
    if (text.length < 3) return null;
    const sql = `
        SELECT u.id AS officer_id, u.region, u.tenant_id
          FROM users u
         WHERE u.role = 'extension_officer' AND COALESCE(u.is_active, true) = true AND u.is_demo = false
           AND ($2::uuid IS NULL OR u.tenant_id IS NOT DISTINCT FROM $2::uuid)
           AND (u.region ILIKE $1 OR EXISTS (
                SELECT 1 FROM farmers f
                 WHERE f.assigned_officer_id = u.id AND COALESCE(f.is_demo, false) = false
                   AND (f.region ILIKE $1 OR f.district ILIKE $1 OR f.village ILIKE $1)))
         ORDER BY (SELECT COUNT(*) FROM farmers c WHERE c.assigned_officer_id = u.id), u.created_at
         LIMIT 1`;
    const params = [text.replace(/[%_\\]/g, ''), tenantId];
    type Row = { officer_id: string; region: string | null; tenant_id: string | null };
    const { rows } = client ? await client.query<Row>(sql, params) : await query<Row>(sql, params);
    return rows[0] ? { officerId: rows[0].officer_id, region: rows[0].region, tenantId: rows[0].tenant_id } : null;
}
