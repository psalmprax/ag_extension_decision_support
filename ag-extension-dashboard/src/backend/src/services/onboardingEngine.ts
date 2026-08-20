/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from './databaseService';
import { logger } from '../utils/logger';
import type { FarmerOnboardingSessionRow } from '../types/rowTypes';

interface OnboardingProcessResult {
    isHandled: boolean;
    isRegistered: boolean;
    farmerId?: string;
    responseMessage?: string;
    completedNow?: boolean;
}

const REGIONAL_COORDINATES: Record<string, { lat: number; lng: number }> = {
    nakuru: { lat: -0.3031, lng: 36.0800 },
    kiambu: { lat: -1.1714, lng: 36.8356 },
    'uasin gishu': { lat: 0.5143, lng: 35.2698 },
    eldoret: { lat: 0.5143, lng: 35.2698 },
    machakos: { lat: -1.5177, lng: 37.2634 },
    meru: { lat: 0.0463, lng: 37.6559 },
    makueni: { lat: -1.7831, lng: 37.6288 },
    nyeri: { lat: -0.4197, lng: 36.9511 },
    kakamega: { lat: 0.2827, lng: 34.7519 },
    kisumu: { lat: -0.0917, lng: 34.7680 },
    kilifi: { lat: -3.6305, lng: 39.8499 },
    default: { lat: -1.286389, lng: 36.817223 }, // Nairobi / Central Hub
};

function getRegionCoordinates(region: string): { lat: number; lng: number } {
    const key = region.trim().toLowerCase();
    for (const [r, coords] of Object.entries(REGIONAL_COORDINATES)) {
        if (key.includes(r)) return coords;
    }
    return REGIONAL_COORDINATES.default;
}

class OnboardingEngine {
    /**
     * Check if a farmer is already registered by phone or telegram identifier
     */
    async findFarmerByIdentifier(identifier: string, channel: 'sms' | 'whatsapp' | 'telegram', tenantId?: string | null): Promise<any | null> {
        try {
            const cleanPhone = identifier.replace(/[^\d+]/g, '');
            // Query by phone or notes matching identifier
            let sql = `SELECT * FROM farmers WHERE phone = $1 OR phone = $2`;
            const params: any[] = [identifier, cleanPhone];

            if (tenantId) {
                sql += ` AND (tenant_id = $3 OR tenant_id IS NULL)`;
                params.push(tenantId);
            }
            sql += ` LIMIT 1`;

            const { rows } = await query(sql, params);
            if (rows.length > 0) return rows[0];

            if (channel === 'telegram') {
                const tgSql = `SELECT * FROM farmers WHERE notes ILIKE $1 LIMIT 1`;
                const tgRes = await query(tgSql, [`%tg:${identifier}%`]);
                if (tgRes.rows.length > 0) return tgRes.rows[0];
            }

            return null;
        } catch (error) {
            logger.warn('Failed to query farmer by identifier:', error);
            return null;
        }
    }

    private async handleInitialGreeting(
        session: FarmerOnboardingSessionRow,
        text: string,
        senderName: string | undefined,
        isTriggerKeyword: boolean,
        data: Record<string, any>
    ): Promise<OnboardingProcessResult> {
        const defaultName = senderName && senderName.trim().length > 2 ? senderName.trim() : '';
        if (defaultName && isTriggerKeyword) {
            data.name = defaultName;
            await this.updateSession(session.id, 'awaiting_crop', data);
            return {
                isHandled: true,
                isRegistered: false,
                responseMessage: `🌾 Welcome to the Agricultural Advisory Network, *${defaultName}*!\n\nLet's configure your advisory profile.\n\n👉 What is your *Primary Crop*? (e.g. Maize, Coffee, Cassava, Rice, Tea, Tomato)`,
            };
        }

        await this.updateSession(session.id, 'awaiting_name', data);
        return {
            isHandled: true,
            isRegistered: false,
            responseMessage: `🌾 *Welcome to the Agricultural Advisory Network!*\n\nLet's get your farm registered for real-time weather forecasts, AI disease diagnosis, and extension support.\n\n👉 What is your *Full Name*?`,
        };
    }

    private async handleAwaitingName(
        session: FarmerOnboardingSessionRow,
        text: string,
        data: Record<string, any>
    ): Promise<OnboardingProcessResult> {
        const name = text.replace(/^(my name is|i am|naitwa)\s+/i, '').trim();
        data.name = name || 'Farmer';
        await this.updateSession(session.id, 'awaiting_crop', data);
        return {
            isHandled: true,
            isRegistered: false,
            responseMessage: `Great to connect, *${data.name}*! 🌽\n\n👉 What is your *Primary Crop*? (e.g. Maize, Coffee, Cassava, Rice, Beans, Tea)`,
        };
    }

    private async handleAwaitingCrop(
        session: FarmerOnboardingSessionRow,
        text: string,
        data: Record<string, any>
    ): Promise<OnboardingProcessResult> {
        data.crop = text.replace(/^(i grow|crop is|crop:)\s+/i, '').trim();
        await this.updateSession(session.id, 'awaiting_region', data);
        return {
            isHandled: true,
            isRegistered: false,
            responseMessage: `Noted: *${data.crop}* 🌱\n\n👉 In which *Region or County* is your farm located? (e.g. Nakuru, Uasin Gishu, Kiambu, Machakos, Meru)`,
        };
    }

    private async handleAwaitingRegion(
        session: FarmerOnboardingSessionRow,
        text: string,
        data: Record<string, any>
    ): Promise<OnboardingProcessResult> {
        data.region = text.replace(/^(i am in|region is|county:)\s+/i, '').trim();
        await this.updateSession(session.id, 'awaiting_size', data);
        return {
            isHandled: true,
            isRegistered: false,
            responseMessage: `Got it: *${data.region}* 📍\n\n👉 Almost done! What is the estimated *Size of your Farm* in hectares or acres? (e.g. 2.5 ha, 5 acres)`,
        };
    }

    private async handleAwaitingSize(
        session: FarmerOnboardingSessionRow,
        text: string,
        data: Record<string, any>,
        channel: 'sms' | 'whatsapp' | 'telegram',
        identifier: string,
        tenantId?: string | null
    ): Promise<OnboardingProcessResult> {
        const rawSize = text.replace(/[^\d.]/g, '');
        const parsedSize = parseFloat(rawSize) || 2.0;
        data.farmSize = parsedSize;

        const nameParts = (data.name || 'Valued Farmer').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Valued';
        const lastName = nameParts.slice(1).join(' ') || 'Farmer';
        const coords = getRegionCoordinates(data.region || 'default');

        const finalTenantId = tenantId || (await this.getDefaultTenantId());
        const notes = channel === 'telegram' ? `Auto-enrolled via Telegram [tg:${identifier}]` : `Auto-enrolled via ${channel.toUpperCase()} [${identifier}]`;

        const insertResult = await query(
            `INSERT INTO farmers (
                first_name, last_name, phone, region, crops, farm_size_hectares,
                location_lat, location_lng, notes, tenant_id, language_preference
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`,
            [
                firstName,
                lastName,
                identifier,
                data.region || 'Central Hub',
                [data.crop || 'Maize'],
                parsedSize,
                coords.lat,
                coords.lng,
                notes,
                finalTenantId,
                'en',
            ]
        );

        const newFarmerId = insertResult.rows[0]?.id;
        await this.updateSession(session.id, 'completed', data, newFarmerId);

        return {
            isHandled: true,
            isRegistered: true,
            completedNow: true,
            farmerId: newFarmerId,
            responseMessage: `🎉 *Registration Complete!*\n\nWelcome aboard, *${data.name}*!\nYour Farm Profile is active for *${data.region}* (${data.crop}, ${parsedSize} ha).\n\n📱 *How you can use this channel:*\n• Ask any crop management question or disease symptom\n• Type *WEATHER* for local 7-day agricultural forecasts\n• Type *PRICES* for regional market commodity trends\n• Type *VISIT* to request an extension officer field visit`,
        };
    }

    /**
     * Process an incoming message through the auto-onboarding state machine
     */
    async processIncomingMessage(params: {
        channel: 'sms' | 'whatsapp' | 'telegram';
        identifier: string;
        message: string;
        senderName?: string;
        tenantId?: string | null;
    }): Promise<OnboardingProcessResult> {
        const { channel, identifier, message, senderName, tenantId } = params;
        const text = message.trim();

        // 1. Check if farmer is already registered
        const existingFarmer = await this.findFarmerByIdentifier(identifier, channel, tenantId);
        if (existingFarmer) {
            return {
                isHandled: false,
                isRegistered: true,
                farmerId: existingFarmer.id,
            };
        }

        // 2. Fetch or create active onboarding session
        const session = await this.getOrCreateSession(channel, identifier, tenantId);
        const data = (session.collected_data || {}) as Record<string, any>;
        const currentStep = session.step;

        const isTriggerKeyword = /^(start|habari|join|register|mambo|hello|hi|\/start|\/register)$/i.test(text);

        if (isTriggerKeyword || (currentStep === 'awaiting_name' && !data.name)) {
            return this.handleInitialGreeting(session, text, senderName, isTriggerKeyword, data);
        }

        if (currentStep === 'awaiting_name') {
            return this.handleAwaitingName(session, text, data);
        }

        if (currentStep === 'awaiting_crop') {
            return this.handleAwaitingCrop(session, text, data);
        }

        if (currentStep === 'awaiting_region') {
            return this.handleAwaitingRegion(session, text, data);
        }

        if (currentStep === 'awaiting_size') {
            return this.handleAwaitingSize(session, text, data, channel, identifier, tenantId);
        }

        return {
            isHandled: true,
            isRegistered: false,
            responseMessage: `Please type *START* to set up your farmer advisory profile.`,
        };
    }

    private async getOrCreateSession(channel: string, identifier: string, tenantId?: string | null): Promise<FarmerOnboardingSessionRow> {
        const existing = await query<FarmerOnboardingSessionRow>(
            `SELECT * FROM farmer_onboarding_sessions WHERE channel = $1 AND external_identifier = $2`,
            [channel, identifier]
        );
        if (existing.rows[0]) {
            return existing.rows[0];
        }

        const created = await query<FarmerOnboardingSessionRow>(
            `INSERT INTO farmer_onboarding_sessions (channel, external_identifier, step, tenant_id, collected_data)
             VALUES ($1, $2, 'awaiting_name', $3, '{}'::jsonb)
             RETURNING *`,
            [channel, identifier, tenantId || null]
        );
        return created.rows[0];
    }

    private async updateSession(sessionId: string, step: string, data: Record<string, any>, farmerId?: string): Promise<void> {
        await query(
            `UPDATE farmer_onboarding_sessions
             SET step = $1, collected_data = $2, created_farmer_id = COALESCE($3, created_farmer_id), updated_at = NOW()
             WHERE id = $4`,
            [step, JSON.stringify(data), farmerId || null, sessionId]
        );
    }

    private async getDefaultTenantId(): Promise<string | null> {
        try {
            const { rows } = await query(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`);
            return rows[0]?.id || null;
        } catch {
            return null;
        }
    }
}

export const onboardingEngine = new OnboardingEngine();
