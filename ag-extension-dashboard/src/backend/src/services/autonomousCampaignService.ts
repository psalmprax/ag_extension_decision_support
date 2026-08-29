/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from './databaseService';
import { logger } from '../utils/logger';
import { smsService } from './smsService';
import { whatsappService } from './whatsappService';
import { telegramService } from './telegramService';
import { AIProviderFactory } from './aiProvider/aiProvider';
import type { AutonomousCampaignRunRow, RegionalAgronomySkillRow } from '../types/rowTypes';

interface GoalCampaignInput {
    goalPrompt: string;
    targetRegion?: string;
    targetCrop?: string;
    channel?: 'all' | 'sms' | 'whatsapp' | 'telegram';
    autoScheduleVisits?: boolean;
    tenantId?: string | null;
    userId?: string | null;
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
}

class AutonomousCampaignService {
    private async fetchRegionalSkillsContext(
        targetRegion?: string | null,
        targetCrop?: string | null
    ): Promise<{ skillsContext: string; count: number }> {
        try {
            let skillSql = `SELECT * FROM regional_agronomy_skills WHERE 1=1`;
            const skillParams: any[] = [];
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

    private async queryTargetFarmers(
        tenantId?: string | null,
        targetRegion?: string | null,
        targetCrop?: string | null
    ): Promise<any[]> {
        let farmerSql = `SELECT * FROM farmers WHERE 1=1`;
        const farmerParams: any[] = [];

        if (tenantId) {
            farmerParams.push(tenantId);
            farmerSql += ` AND (tenant_id = $${farmerParams.length} OR tenant_id IS NULL)`;
        }
        if (targetRegion && targetRegion !== 'all') {
            farmerParams.push(`%${targetRegion}%`);
            farmerSql += ` AND region ILIKE $${farmerParams.length}`;
        }
        if (targetCrop && targetCrop !== 'all') {
            farmerParams.push(`%${targetCrop}%`);
            farmerSql += ` AND array_to_string(crops, ',') ILIKE $${farmerParams.length}`;
        }

        farmerSql += ` ORDER BY vital_score ASC LIMIT 100`;
        const { rows } = await query<any>(farmerSql, farmerParams);
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
            const prompt = `You are the Agricultural Extension Autonomous Campaign Agent.
User Objective: "${goalPrompt}"
Target Region: ${targetRegion || 'Regional Hub'}
Target Crop: ${targetCrop || 'General Crops'}
Regional Knowledge Skills Context:
${skillsContext || 'No regional overrides found; use standard agronomic best practices.'}

Generate a concise, actionable, and warm advisory SMS/WhatsApp message (max 150 words) suitable for smallholder farmers. Include key action items and emoji indicators.`;

            const aiResponse = await ai.generateText(prompt);
            return (aiResponse.text || '').trim();
        } catch {
            return `🌾 Agricultural Advisory Alert: Regarding ${goalPrompt}. Please inspect your crops, monitor soil moisture, and contact your extension officer for guidance.`;
        }
    }

    private async dispatchToFarmer(
        farmer: any,
        personalizedMsg: string,
        channel: string,
        userId?: string | null
    ): Promise<{ sms: number; whatsapp: number; telegram: number }> {
        const dispatched = { sms: 0, whatsapp: 0, telegram: 0 };
        const farmerPhone = farmer.phone;
        const wantsSms = channel === 'all' || channel === 'sms';
        const wantsWhatsapp = channel === 'all' || channel === 'whatsapp';
        const wantsTelegram = channel === 'all' || channel === 'telegram';

        if (wantsSms && farmerPhone) {
            dispatched.sms = await this.dispatchSms(farmer, personalizedMsg, userId);
        }
        if (wantsWhatsapp && farmerPhone) {
            dispatched.whatsapp = await this.dispatchWhatsApp(farmer, personalizedMsg, userId);
        }
        if (wantsTelegram && farmer.notes?.includes('tg:')) {
            dispatched.telegram = await this.dispatchTelegram(farmer, personalizedMsg, userId);
        }
        return dispatched;
    }

    private async dispatchSms(farmer: any, message: string, userId?: string | null): Promise<number> {
        try {
            const sent = await smsService.sendSMS({
                to: farmer.phone,
                message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            return sent ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch SMS to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchWhatsApp(farmer: any, message: string, userId?: string | null): Promise<number> {
        try {
            const result = await whatsappService.sendMessage({
                to: farmer.phone,
                message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            return result.success ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch WhatsApp message to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchTelegram(farmer: any, message: string, userId?: string | null): Promise<number> {
        const tgChatId = farmer.notes?.match(/tg:(\d+)/)?.[1];
        if (!tgChatId) return 0;
        try {
            const result = await telegramService.sendMessage({
                chatId: tgChatId,
                text: message,
                farmerId: farmer.id,
                senderId: userId || undefined,
            });
            return result.success ? 1 : 0;
        } catch (dispatchErr) {
            logger.warn(`Failed to dispatch Telegram message to farmer ${farmer.id}:`, dispatchErr);
            return 0;
        }
    }

    private async dispatchToFarmerCohort(
        farmers: any[],
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
        farmers: any[],
        goalPrompt: string,
        tenantId?: string | null,
        userId?: string | null
    ): Promise<number> {
        let count = 0;
        const atRiskFarmers = farmers.filter(f => (f.vital_score || 80) < 65);
        for (const atRisk of atRiskFarmers) {
            try {
                const officerId = userId || (await this.getDefaultOfficerId(tenantId));
                await query(
                    `INSERT INTO visits (
                        farmer_id, user_id, scheduled_date, status, notes, created_at, updated_at
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
    async executeGoalCampaign(input: GoalCampaignInput): Promise<GoalCampaignResult> {
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

        // 2. Fetch Regional Skills
        const { skillsContext, count: skillCount } = await this.fetchRegionalSkillsContext(targetRegion, targetCrop);
        if (skillCount > 0) {
            addTrace('Closed-Loop Knowledge Retrieval', `Injected ${skillCount} regional agronomy skill card(s) from field reports.`);
        }

        // 3. Query Farmers
        const farmers = await this.queryTargetFarmers(tenantId, targetRegion, targetCrop);
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

        // 4. Synthesize Advisory Message
        const advisoryText = await this.synthesizeAdvisoryText(goalPrompt, targetRegion, targetCrop, skillsContext);
        addTrace('Advisory Synthesis', 'Generated contextualized advisory message.');

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
            const params: any[] = [];
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
            let sql = `SELECT id FROM users WHERE role IN ('extension_officer', 'regional_manager', 'admin')`;
            const params: any[] = [];
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
