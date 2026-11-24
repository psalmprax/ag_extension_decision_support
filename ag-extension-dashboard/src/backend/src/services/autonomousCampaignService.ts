import { query } from './databaseService';
import { logger } from '../utils/logger';
import { smsService } from './smsService';
import { whatsappService } from './whatsappService';
import { telegramService } from './telegramService';
import { usageService } from './usageService';
import { AIProviderFactory } from './aiProvider/aiProvider';
import type { AutonomousCampaignRunRow, RegionalAgronomySkillRow } from '../types/rowTypes';
import { demoSql } from '@/services/demoScope';
import { farmerScopeSql, type ScopePrincipal } from '@/services/access/farmerScope';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

/** The farmer columns a campaign reads (the query selects f.*). */
interface CampaignFarmer {
    id: string;
    phone: string | null;
    sms_opt_out: boolean | null;
    notes: string | null;
    first_name: string | null;
    last_name: string | null;
    vital_score: number | null;
    assigned_officer_id: string | null;
}

/** Longest campaign message, so it stays within a few SMS parts. */
export const CAMPAIGN_MESSAGE_MAX = 600;

interface GoalCampaignInput {
    goalPrompt: string;
    targetRegion?: string;
    targetCrop?: string;
    channel?: 'all' | 'sms' | 'whatsapp' | 'telegram';
    autoScheduleVisits?: boolean;
    tenantId?: string | null;
    userId?: string | null;
    /** Who launched it: the campaign reaches only farmers this person may see. */
    principal: ScopePrincipal;
    /** The message the officer read and approved; the AI's draft is never sent unread. */
    message: string;
}

type DraftInput = Omit<GoalCampaignInput, 'message' | 'channel' | 'autoScheduleVisits'>;

export interface GoalCampaignDraft {
    success: true;
    /** Empty when the AI could not write one; the officer then writes it. */
    draftText: string;
    affectedFarmersCount: number;
    /** What the safety check would stop in this draft; the officer must remove it before sending. */
    violations: string[];
}

interface CampaignStepTrace {
    step: string;
    status: 'completed' | 'in_progress' | 'skipped' | 'failed';
    detail: string;
    data?: Record<string, unknown>;
    timestamp: string;
}

interface GoalCampaignResult {
    success: boolean;
    campaignId: string;
    summary: string;
    affectedFarmersCount: number;
    dispatchedMessagesCount: number;
    scheduledVisitsCount: number;
    executionTrace: CampaignStepTrace[];
    error?: string;
    violations?: string[];
}

/** Rates, doses and product waiting periods the safety check stops; a campaign never carries them. */
export function campaignMessageViolations(message: string): string[] {
    return agronomicSafetyGuard.scanGeneratedAdvice(message).violations;
}

class AutonomousCampaignService {
    private async fetchRegionalSkillsContext(
        targetRegion?: string | null,
        targetCrop?: string | null
    ): Promise<{ skillsContext: string; count: number }> {
        try {
            let skillSql = `SELECT * FROM regional_agronomy_skills WHERE 1=1`;
            const skillParams: unknown[] = [];
            if (targetRegion) {
                skillParams.push(`%${targetRegion}%`);
                skillSql += ` AND region ILIKE $${skillParams.length}`;
            }
            if (targetCrop) {
                skillParams.push(`%${targetCrop}%`);
                skillSql += ` AND crop ILIKE $${skillParams.length}`;
            }
            skillSql += ` ORDER BY confidence_score DESC LIMIT 3`;

            const { rows: skillRows } = await query<RegionalAgronomySkillRow>(skillSql, skillParams);
            if (skillRows.length > 0) {
                const skillsContext = skillRows.map(s => `[Skill: ${s.title}] ${s.skill_markdown}`).join('\n\n');
                return { skillsContext, count: skillRows.length };
            }
        } catch (err) {
            logger.warn('Failed to retrieve regional skills for campaign:', err);
        }
        return { skillsContext: '', count: 0 };
    }

    /**
     * The farmers a campaign reaches: only those its launcher may see (an officer their
     * own farmers, a manager their region), never demo farmers, and the region and crop
     * matched exactly. A substring match sent "Central" advice to "North Central" and
     * "pea" advice to chickpea and groundnut growers.
     */
    private async queryTargetFarmers(
        principal: ScopePrincipal,
        tenantId?: string | null,
        targetRegion?: string | null,
        targetCrop?: string | null
    ): Promise<CampaignFarmer[]> {
        const scope = await farmerScopeSql(principal, 'f', 1);
        // The shared rule also keeps demo farmers out.
        let farmerSql = `SELECT f.* FROM farmers f WHERE ${scope.sql}`;
        const farmerParams: unknown[] = [...scope.params];

        if (tenantId) {
            farmerParams.push(tenantId);
            farmerSql += ` AND (f.tenant_id = $${farmerParams.length} OR f.tenant_id IS NULL)`;
        }
        if (targetRegion && targetRegion !== 'all') {
            farmerParams.push(targetRegion.trim());
            farmerSql += ` AND lower(f.region) = lower($${farmerParams.length})`;
        }
        if (targetCrop && targetCrop !== 'all') {
            farmerParams.push(targetCrop.trim());
            farmerSql += ` AND EXISTS (SELECT 1 FROM unnest(f.crops) crop WHERE lower(crop) = lower($${farmerParams.length}))`;
        }

        farmerSql += ` ORDER BY f.vital_score ASC NULLS LAST LIMIT 100`;
        const { rows } = await query<CampaignFarmer>(farmerSql, farmerParams);
        return rows;
    }

    private async synthesizeAdvisoryText(
        goalPrompt: string,
        targetRegion?: string | null,
        targetCrop?: string | null,
        skillsContext?: string
    ): Promise<string> {
        try {
            const ai = await AIProviderFactory.getProvider();
            const prompt = `Draft a text message from an extension officer to smallholder farmers. The officer will read and edit it before it is sent.
Officer's aim: "${goalPrompt}"
Region: ${targetRegion || 'not given'}
Crop: ${targetCrop || 'not given'}
Notes from the officer's own field reports:
${skillsContext || 'none'}

Rules: under ${CAMPAIGN_MESSAGE_MAX} characters, plain words, no emoji, no headings.
Say what to look for, when to check and whom to tell. Do not name a product, dose, rate, mixing amount or waiting period, and do not invent figures; where a treatment may be needed, tell farmers to ask their extension officer, who will check the registered label.
Use only the notes above and general, safe practice; if the aim needs more than that, ask farmers to contact their officer.`;

            const aiResponse = await ai.generateText(prompt);
            return (aiResponse.text || '').trim().slice(0, CAMPAIGN_MESSAGE_MAX);
        } catch (error) {
            logger.warn('Campaign draft could not be written by the AI; the officer writes it:', error);
            return '';
        }
    }

    private async dispatchToFarmer(
        farmer: CampaignFarmer,
        personalizedMsg: string,
        channel: string,
        userId?: string | null
    ): Promise<{ sms: number; whatsapp: number; telegram: number }> {
        const dispatched = { sms: 0, whatsapp: 0, telegram: 0 };
        // A farmer who replied STOP gets no campaign messages on their phone.
        const farmerPhone = farmer.sms_opt_out ? null : farmer.phone;
        const wantsSms = channel === 'all' || channel === 'sms';
        const wantsWhatsapp = channel === 'all' || channel === 'whatsapp';
        const wantsTelegram = channel === 'all' || channel === 'telegram';

        if (wantsSms && farmerPhone) {
            dispatched.sms = await this.dispatchSms(farmer, farmerPhone, personalizedMsg, userId);
        }
        if (wantsWhatsapp && farmerPhone) {
            dispatched.whatsapp = await this.dispatchWhatsApp(farmer, farmerPhone, personalizedMsg, userId);
        }
        if (wantsTelegram && farmer.notes?.includes('tg:')) {
            dispatched.telegram = await this.dispatchTelegram(farmer, personalizedMsg, userId);
        }
        return dispatched;
    }

    /**
     * Each message is charged to the officer who launched the campaign: sent only while
     * their plan has quota left, and counted once delivered. System runs (no userId) are
     * not charged to anyone.
     */
    private async withinQuota(userId: string | null | undefined, type: 'sms' | 'whatsapp'): Promise<boolean> {
        if (!userId) return true;
        const allowed = await usageService.hasAllowance(userId, type);
        if (!allowed) logger.warn(`Campaign message skipped: ${type} quota exhausted or plan does not include it (user ${userId})`);
        return allowed;
    }

    private async countUsage(userId: string | null | undefined, type: 'sms' | 'whatsapp'): Promise<void> {
        if (!userId) return;
        await usageService.incrementUsage(userId, type).catch(err => logger.warn(`Failed to meter campaign ${type} usage:`, err));
    }

    private async dispatchSms(farmer: CampaignFarmer, to: string, message: string, userId?: string | null): Promise<number> {
        try {
            if (!(await this.withinQuota(userId, 'sms'))) return 0;
            const sent = await smsService.sendSMS({
                to,
                message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            if (sent) await this.countUsage(userId, 'sms');
            return sent ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch SMS to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchWhatsApp(farmer: CampaignFarmer, to: string, message: string, userId?: string | null): Promise<number> {
        try {
            if (!(await this.withinQuota(userId, 'whatsapp'))) return 0;
            const result = await whatsappService.sendMessage({
                to,
                message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            if (result.success) await this.countUsage(userId, 'whatsapp');
            return result.success ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch WhatsApp message to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchTelegram(farmer: CampaignFarmer, message: string, userId?: string | null): Promise<number> {
        const tgChatId = farmer.notes?.match(/tg:(\d+)/)?.[1];
        if (!tgChatId) return 0;
        try {
            // Telegram falls under the WhatsApp & Telegram broadcasting quota.
            if (!(await this.withinQuota(userId, 'whatsapp'))) return 0;
            const result = await telegramService.sendMessage({
                chatId: tgChatId,
                text: message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            if (result.success) await this.countUsage(userId, 'whatsapp');
            return result.success ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch Telegram message to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchToFarmerCohort(
        farmers: CampaignFarmer[],
        advisoryText: string,
        channel: string,
        userId?: string | null
    ): Promise<{ total: number; byChannel: { sms: number; whatsapp: number; telegram: number } }> {
        const totals = { sms: 0, whatsapp: 0, telegram: 0 };
        for (const farmer of farmers) {
            const farmerName = `${farmer.first_name || 'Farmer'} ${farmer.last_name || ''}`.trim();
            const personalizedMsg = `Hello ${farmerName},\n${advisoryText}`;
            try {
                const dispatched = await this.dispatchToFarmer(farmer, personalizedMsg, channel, userId);
                totals.sms += dispatched.sms;
                totals.whatsapp += dispatched.whatsapp;
                totals.telegram += dispatched.telegram;
            } catch (dispatchErr) {
                logger.warn(`Failed to dispatch campaign message to farmer ${farmer.id}:`, dispatchErr);
            }
        }
        const total = totals.sms + totals.whatsapp + totals.telegram;
        return { total, byChannel: totals };
    }

    private async scheduleAtRiskVisits(
        farmers: CampaignFarmer[],
        goalPrompt: string,
        tenantId?: string | null,
        userId?: string | null
    ): Promise<number> {
        let count = 0;
        const atRiskFarmers = farmers.filter(f => (f.vital_score || 80) < 65);
        for (const atRisk of atRiskFarmers) {
            try {
                // The visit is the farmer's own officer's to make, not the campaign launcher's.
                const officerId = atRisk.assigned_officer_id || userId || (await this.getDefaultOfficerId(tenantId));
                await query(
                    `INSERT INTO visits (
                        farmer_id, officer_id, scheduled_at, status, notes, created_at, updated_at
                    ) VALUES ($1, $2, NOW() + INTERVAL '2 days', 'scheduled', $3, NOW(), NOW())`,
                    [
                        atRisk.id,
                        officerId,
                        `Autonomous Campaign Action Item: Inspect for ${goalPrompt} (Vital score: ${atRisk.vital_score})`,
                    ]
                );
                count++;
            } catch (visitErr) {
                logger.warn('Failed to queue automated field visit:', visitErr);
            }
        }
        return count;
    }

    private async persistCampaignRun(params: {
        tenantId?: string | null;
        userId?: string | null;
        goalPrompt: string;
        targetRegion?: string | null;
        targetCrop?: string | null;
        affectedFarmersCount: number;
        dispatchedMessagesCount: number;
        scheduledVisitsCount: number;
        trace: CampaignStepTrace[];
        advisoryText: string;
    }): Promise<string> {
        let campaignId = 'run-' + Date.now();
        try {
            const { rows } = await query<AutonomousCampaignRunRow>(
                `INSERT INTO autonomous_campaign_runs (
                    tenant_id, created_by, goal_prompt, target_region, target_crop,
                    status, affected_farmers_count, dispatched_messages_count, scheduled_visits_count,
                    execution_trace, advisory_summary
                ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10)
                RETURNING id`,
                [
                    params.tenantId || null,
                    params.userId || null,
                    params.goalPrompt,
                    params.targetRegion || null,
                    params.targetCrop || null,
                    params.affectedFarmersCount,
                    params.dispatchedMessagesCount,
                    params.scheduledVisitsCount,
                    JSON.stringify(params.trace),
                    params.advisoryText,
                ]
            );
            if (rows[0]) campaignId = rows[0].id;
        } catch (saveErr) {
            logger.error('Failed to persist autonomous campaign run:', saveErr);
        }
        return campaignId;
    }

    /**
     * Executes an autonomous goal-driven campaign end-to-end
     */
    /**
     * Step one: who would receive it and an AI draft for the officer to read and edit. Nothing is
     * sent. The draft is checked with the same rules that the send applies.
     */
    async draftGoalCampaign(input: DraftInput): Promise<GoalCampaignDraft> {
        const { skillsContext } = await this.fetchRegionalSkillsContext(input.targetRegion, input.targetCrop);
        const farmers = await this.queryTargetFarmers(input.principal, input.tenantId, input.targetRegion, input.targetCrop);
        const draftText = farmers.length > 0
            ? await this.synthesizeAdvisoryText(input.goalPrompt, input.targetRegion, input.targetCrop, skillsContext)
            : '';
        return { success: true, draftText, affectedFarmersCount: farmers.length, violations: draftText ? campaignMessageViolations(draftText) : [] };
    }

    async executeGoalCampaign(input: GoalCampaignInput): Promise<GoalCampaignResult> {
        const message = input.message.trim();
        const violations = campaignMessageViolations(message);
        if (!message || message.length > CAMPAIGN_MESSAGE_MAX || violations.length > 0) {
            return {
                success: false, campaignId: 'none', summary: '', affectedFarmersCount: 0, dispatchedMessagesCount: 0,
                scheduledVisitsCount: 0, executionTrace: [], violations,
                error: !message
                    ? 'Write the message before sending.'
                    : message.length > CAMPAIGN_MESSAGE_MAX
                        ? `Keep the message under ${CAMPAIGN_MESSAGE_MAX} characters.`
                        : 'The message gives a rate, dose or waiting period. Remove it and tell farmers to ask their officer, who checks the label.',
            };
        }
        const {
            goalPrompt,
            targetRegion,
            targetCrop,
            channel = 'all',
            autoScheduleVisits = true,
            tenantId,
            userId,
        } = input;

        const trace: CampaignStepTrace[] = [];
        const addTrace = (step: string, detail: string, data?: Record<string, unknown>) => {
            trace.push({
                step,
                status: 'completed',
                detail,
                data,
                timestamp: new Date().toISOString(),
            });
        };

        // 1. Analyze Goal
        addTrace('Intent Analysis', `Parsing objective: "${goalPrompt}"`);

        // 3. Query Farmers
        const farmers = await this.queryTargetFarmers(input.principal, tenantId, targetRegion, targetCrop);
        const affectedFarmersCount = farmers.length;
        addTrace(
            'Target Cohort Selection',
            `Identified ${affectedFarmersCount} farmers matching criteria (Region: ${targetRegion || 'Any'}, Crop: ${targetCrop || 'Any'}).`
        );

        if (affectedFarmersCount === 0) {
            return {
                success: true,
                campaignId: 'none',
                summary: 'No farmers matched the specified region and crop criteria.',
                affectedFarmersCount: 0,
                dispatchedMessagesCount: 0,
                scheduledVisitsCount: 0,
                executionTrace: trace,
            };
        }

        // 4. The officer's approved message
        const advisoryText = message;
        addTrace('Approved message', 'Using the message the officer read and approved.');

        // 5. Multi-Channel Dispatch
        const { total: dispatchedMessagesCount, byChannel } = await this.dispatchToFarmerCohort(farmers, advisoryText, channel, userId);
        const channelBreakdown = [
            byChannel.sms > 0 ? `SMS: ${byChannel.sms}` : '',
            byChannel.whatsapp > 0 ? `WhatsApp: ${byChannel.whatsapp}` : '',
            byChannel.telegram > 0 ? `Telegram: ${byChannel.telegram}` : '',
        ].filter(Boolean).join(', ');
        addTrace(
            'Multi-Channel Dispatch',
            `Dispatched ${dispatchedMessagesCount} broadcast messages${channelBreakdown ? ` (${channelBreakdown})` : ''}.`
        );

        // 6. Schedule Field Visits
        let scheduledVisitsCount = 0;
        if (autoScheduleVisits) {
            scheduledVisitsCount = await this.scheduleAtRiskVisits(farmers, goalPrompt, tenantId, userId);
            if (scheduledVisitsCount > 0) {
                addTrace('Field Inspection Scheduling', `Automatically queued ${scheduledVisitsCount} priority field inspection visits for at-risk farmers.`);
            }
        }

        // 7. Persist Campaign Run
        const campaignId = await this.persistCampaignRun({
            tenantId,
            userId,
            goalPrompt,
            targetRegion,
            targetCrop,
            affectedFarmersCount,
            dispatchedMessagesCount,
            scheduledVisitsCount,
            trace,
            advisoryText,
        });

        return {
            success: true,
            campaignId,
            summary: `Campaign executed successfully. ${affectedFarmersCount} farmers targeted, ${dispatchedMessagesCount} advisories dispatched, and ${scheduledVisitsCount} field visits queued.`,
            affectedFarmersCount,
            dispatchedMessagesCount,
            scheduledVisitsCount,
            executionTrace: trace,
        };
    }

    /**
     * Get recent campaign runs
     */
    async getCampaignHistory(tenantId?: string | null): Promise<AutonomousCampaignRunRow[]> {
        try {
            let sql = `SELECT * FROM autonomous_campaign_runs WHERE 1=1`;
            const params: unknown[] = [];
            if (tenantId) {
                params.push(tenantId);
                sql += ` AND (tenant_id = $1 OR tenant_id IS NULL)`;
            }
            sql += ` ORDER BY created_at DESC LIMIT 30`;

            const { rows } = await query<AutonomousCampaignRunRow>(sql, params);
            return rows;
        } catch (error) {
            logger.error('Failed to get campaign history:', error);
            return [];
        }
    }

    private async getDefaultOfficerId(tenantId?: string | null): Promise<string | null> {
        try {
            let sql = `SELECT id FROM users WHERE role IN ('extension_officer', 'regional_manager', 'admin') AND ${demoSql('users')}`;
            const params: unknown[] = [];
            if (tenantId) {
                params.push(tenantId);
                sql += ` AND (tenant_id = $1 OR tenant_id IS NULL)`;
            }
            sql += ` ORDER BY created_at LIMIT 1`;
            const { rows } = await query(sql, params);
            return rows[0]?.id || null;
        } catch {
            return null;
        }
    }
}

export const autonomousCampaignService = new AutonomousCampaignService();
