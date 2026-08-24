import { createHash } from 'crypto';
import { query } from './databaseService';
import { NasaPowerService, DailyPoint } from './nasaPowerService';
import { whatsappService } from './whatsappService';
import { smsService } from './smsService';
import { addEmailJob } from '@/queues/emailQueue';
import { logger } from '@/utils/logger';

export type AdvisoryRuleKey =
    | 'planting_window'
    | 'dry_spell_warning'
    | 'faw_degree_day'
    | 'late_blight_risk';

export interface DailyClimate {
    date: string;
    rainMm: number;
    tempMinC: number;
    tempMaxC: number;
    humidityPct: number;
}

export interface ClimateSnapshot {
    district: string;
    daily: DailyClimate[];
}

export interface RuleVerdict {
    shouldDispatch: boolean;
    severity: 'info' | 'warning' | 'urgent';
    message: string;
    params: Record<string, number | string>;
}

const num = (point: DailyPoint, key: string): number => {
    const value = point[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const toDailyClimate = (points: DailyPoint[]): DailyClimate[] =>
    points.map(p => ({
        date: String(p.date),
        rainMm: num(p, 'PRECTOTCORR'),
        tempMinC: num(p, 'T2M_MIN') || num(p, 'T2M'),
        tempMaxC: num(p, 'T2M_MAX') || num(p, 'T2M'),
        humidityPct: num(p, 'RH2M'),
    }));

/**
 * Pure rule evaluation — no I/O. Each rule reads the trailing climate window
 * and decides whether farmers in the district should be messaged.
 */
export const advisoryRules: Record<AdvisoryRuleKey, (snap: ClimateSnapshot) => RuleVerdict> = {
    // ≥25mm accumulated rain across the trailing week with warm mean temps = planting window opening.
    planting_window: snap => {
        const window = snap.daily.slice(-7);
        if (window.length < 7) return no('insufficient data');
        const rainTotal = window.reduce((s, d) => s + d.rainMm, 0);
        const meanTemp = window.reduce((s, d) => s + (d.tempMinC + d.tempMaxC) / 2, 0) / window.length;
        const should = rainTotal >= 25 && meanTemp >= 18;
        return {
            shouldDispatch: should,
            severity: 'info',
            message: should
                ? `Planting window opening in ${snap.district}: ${Math.round(rainTotal)}mm of rain over the last 7 days with warm soils (${Math.round(meanTemp)}°C average). Plant now to make the most of the moisture.`
                : 'insufficient rain',
            params: { rainTotalMm: Math.round(rainTotal * 10) / 10, meanTempC: Math.round(meanTemp * 10) / 10 },
        };
    },

    // <5mm forecast-equivalent over the trailing 5 days during the season = dry spell.
    dry_spell_warning: snap => {
        const window = snap.daily.slice(-5);
        if (window.length < 5) return no('insufficient data');
        const rainTotal = window.reduce((s, d) => s + d.rainMm, 0);
        const should = rainTotal < 5;
        return {
            shouldDispatch: should,
            severity: 'warning',
            message: should
                ? `Dry spell warning for ${snap.district}: only ${Math.round(rainTotal * 10) / 10}mm of rain in the last 5 days. Conserve soil moisture — mulch where possible and delay top-dressing until rain returns.`
                : 'adequate rain',
            params: { rainTotalMm: Math.round(rainTotal * 10) / 10 },
        };
    },

    // Fall armyworm development accelerates above ~13.8°C base; cumulative degree-days
    // above 380 over the trailing 30 days signal elevated larval pressure.
    faw_degree_day: snap => {
        const window = snap.daily.slice(-30);
        if (window.length < 20) return no('insufficient data');
        const gdd = window.reduce((s, d) => s + Math.max(0, (d.tempMinC + d.tempMaxC) / 2 - 13.8), 0);
        const should = gdd >= 380;
        return {
            shouldDispatch: should,
            severity: 'warning',
            message: should
                ? `Fall armyworm risk is high in ${snap.district} (accumulated heat ${Math.round(gdd)} degree-days). Scout maize fields early in the morning; treat when 2 in 10 plants show fresh leaf damage.`
                : 'below threshold',
            params: { degreeDays: Math.round(gdd) },
        };
    },

    // Simplified BLITECAST: two consecutive days with mean RH ≥90% and mean temp 10–25°C
    // favour late blight sporulation on potato/tomato.
    late_blight_risk: snap => {
        const window = snap.daily.slice(-2);
        if (window.length < 2) return no('insufficient data');
        const favourable = window.filter(d => d.humidityPct >= 90 && d.tempMaxC >= 10 && (d.tempMinC + d.tempMaxC) / 2 <= 25).length;
        const should = favourable === 2;
        return {
            shouldDispatch: should,
            severity: 'urgent',
            message: should
                ? `Late blight risk is severe in ${snap.district} (2 consecutive days of cool, humid conditions). Inspect potato and tomato fields today; apply a protective fungicide before symptoms spread.`
                : 'conditions not favourable',
            params: { favourableDays: favourable },
        };
    },
};

const no = (reason: string): RuleVerdict => ({ shouldDispatch: false, severity: 'info', message: reason, params: {} });

const dedupeHash = (ruleKey: string, district: string, day: string): string =>
    createHash('sha256').update(`${ruleKey}:${district}:${day}`).digest('hex');

interface OptedInRow {
    farmer_id: string;
    phone: string | null;
    channels: string[] | null;
    categories: string[] | null;
    lat: number | null;
    lng: number | null;
}

export const seasonalAdvisoryService = {
    advisoryRules,

    async setPreference(farmerId: string, prefs: { optIn: boolean; channels?: string[]; categories?: string[] }) {
        await query(
            `INSERT INTO advisory_preferences (farmer_id, opt_in, channels, categories, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (farmer_id) DO UPDATE
             SET opt_in = EXCLUDED.opt_in, channels = EXCLUDED.channels, categories = EXCLUDED.categories, updated_at = NOW()`,
            [farmerId, prefs.optIn, prefs.channels || ['whatsapp'], prefs.categories || ['planting_window', 'dry_spell_warning', 'faw_degree_day', 'late_blight_risk']]
        );
    },

    async getPreference(farmerId: string) {
        const { rows } = await query<{ opt_in: boolean; channels: string[] | null; categories: string[] | null }>(
            'SELECT opt_in, channels, categories FROM advisory_preferences WHERE farmer_id = $1',
            [farmerId]
        );
        if (rows.length === 0) return { optIn: true, channels: ['whatsapp'], categories: ['planting_window', 'dry_spell_warning', 'faw_degree_day', 'late_blight_risk'] };
        return { optIn: rows[0].opt_in, channels: rows[0].channels || ['whatsapp'], categories: rows[0].categories || [] };
    },

    async getRecentDispatches(limit = 50) {
        const { rows } = await query<{
            rule_key: string;
            district: string;
            channel: string;
            audience_count: number;
            payload: { message?: string; severity?: string };
            dispatched_at: Date;
        }>(
            'SELECT rule_key, district, channel, audience_count, payload, dispatched_at FROM advisory_dispatches ORDER BY dispatched_at DESC LIMIT $1',
            [limit]
        );
        return rows.map(r => ({
            ruleKey: r.rule_key,
            district: r.district,
            channel: r.channel,
            audienceCount: r.audience_count,
            message: r.payload?.message ?? '',
            severity: r.payload?.severity ?? 'info',
            dispatchedAt: r.dispatched_at,
        }));
    },

    /**
     * Dispatch a single channel message to a farmer safely.
     */
    async dispatchToFarmerChannel(
        channel: string,
        farmer: OptedInRow,
        message: string,
        context: { ruleKey: string; district: string }
    ): Promise<boolean> {
        if (!farmer.phone) return false;
        try {
            if (channel === 'whatsapp') {
                await whatsappService.sendMessage({ to: farmer.phone, message, farmerId: farmer.farmer_id });
                return true;
            }
            if (channel === 'sms') {
                await smsService.sendSMS({ to: farmer.phone, message });
                return true;
            }
        } catch (error) {
            logger.warn(`Advisory ${context.ruleKey}/${context.district} failed via ${channel} for farmer ${farmer.farmer_id}:`, error);
        }
        return false;
    },

    /**
     * Dispatch an advisory verdict to all eligible farmers.
     */
    async dispatchAdvisory(
        ruleKey: string,
        district: string,
        verdict: RuleVerdict,
        farmers: OptedInRow[],
        today: string
    ): Promise<boolean> {
        const hash = dedupeHash(ruleKey, district, today);
        const inserted = await query(
            `INSERT INTO advisory_dispatches (rule_key, district, channel, audience_count, payload, dedupe_hash)
             VALUES ($1, $2, 'multi', 0, $3, $4)
             ON CONFLICT (dedupe_hash) DO NOTHING
             RETURNING id`,
            [ruleKey, district, JSON.stringify({ message: verdict.message, severity: verdict.severity, params: verdict.params }), hash]
        );
        if (inserted.rows.length === 0) return false;

        let audience = 0;
        for (const farmer of farmers) {
            const channels = farmer.channels || ['whatsapp'];
            const categories = farmer.categories || [];
            if (!categories.includes(ruleKey)) continue;

            for (const channel of channels) {
                const sent = await this.dispatchToFarmerChannel(channel, farmer, verdict.message, { ruleKey, district });
                if (sent) audience += 1;
            }
        }

        await query('UPDATE advisory_dispatches SET audience_count = $1 WHERE dedupe_hash = $2', [audience, hash]);
        logger.info(`Advisory dispatched: ${ruleKey} -> ${district} (${audience} farmers)`);
        return true;
    },

    /**
     * Evaluate every rule for one district and dispatch deduped advisories.
     * Returns the rules that fired.
     */
    async evaluateDistrict(district: string, farmers: OptedInRow[], today: string): Promise<string[]> {
        const withCoords = farmers.filter(f => f.lat !== null && f.lng !== null);
        if (withCoords.length === 0) return [];

        const lat = withCoords.reduce((s, f) => s + Number(f.lat), 0) / withCoords.length;
        const lng = withCoords.reduce((s, f) => s + Number(f.lng), 0) / withCoords.length;

        const end = new Date();
        const start = new Date(end.getTime() - 30 * 86400_000);
        const points = await NasaPowerService.getDaily(
            lat,
            lng,
            start.toISOString().slice(0, 10),
            end.toISOString().slice(0, 10),
            ['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR', 'RH2M']
        );
        const daily = toDailyClimate(points);
        if (daily.length < 7) return [];

        const fired: string[] = [];
        for (const ruleKey of Object.keys(advisoryRules) as AdvisoryRuleKey[]) {
            const verdict = advisoryRules[ruleKey]({ district, daily });
            if (!verdict.shouldDispatch) continue;

            const dispatched = await this.dispatchAdvisory(ruleKey, district, verdict, withCoords, today);
            if (dispatched) {
                fired.push(ruleKey);
            }
        }
        return fired;
    },

    /** Daily cycle: evaluate all districts with opted-in farmers, then email an officer digest. */
    async runDailyCycle(): Promise<{ districtsEvaluated: number; advisoriesSent: number }> {
        const today = new Date().toISOString().slice(0, 10);
        const { rows } = await query<{ district: string; farmer_id: string; phone: string | null; channels: string[] | null; categories: string[] | null; lat: number | null; lng: number | null }>(
            `SELECT f.district, f.id AS farmer_id, f.phone, p.channels, p.categories, f.location_lat AS lat, f.location_lng AS lng
             FROM farmers f
             JOIN advisory_preferences p ON p.farmer_id = f.id
             WHERE p.opt_in = true AND f.district IS NOT NULL AND f.is_active = true`
        );

        const byDistrict = new Map<string, OptedInRow[]>();
        for (const row of rows) {
            const list = byDistrict.get(row.district) || [];
            list.push({ farmer_id: row.farmer_id, phone: row.phone, channels: row.channels, categories: row.categories, lat: row.lat, lng: row.lng });
            byDistrict.set(row.district, list);
        }

        let advisoriesSent = 0;
        for (const [district, farmers] of byDistrict) {
            try {
                const fired = await this.evaluateDistrict(district, farmers, today);
                advisoriesSent += fired.length;
            } catch (error) {
                logger.error(`Advisory cycle failed for district ${district}:`, error);
            }
        }

        if (advisoriesSent > 0) {
            await this.sendOfficerDigest(today, advisoriesSent).catch(error =>
                logger.warn('Officer advisory digest failed:', error)
            );
        }
        return { districtsEvaluated: byDistrict.size, advisoriesSent };
    },

    async sendOfficerDigest(day: string, advisoriesSent: number) {
        const { rows } = await query<{ email: string }>(
            `SELECT DISTINCT u.email FROM users u
             JOIN farmers f ON f.assigned_officer_id = u.id
             JOIN advisory_preferences p ON p.farmer_id = f.id
             WHERE p.opt_in = true AND u.email IS NOT NULL`
        );
        for (const row of rows) {
            await addEmailJob({
                to: row.email,
                subject: `GPExts advisory digest — ${day}`,
                text: `${advisoriesSent} proactive advisory(ies) were dispatched to farmers in your districts today. Open the GPExts dashboard to review recent advisories.`,
            });
        }
    },
};
