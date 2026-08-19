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

        // 1. Trace Step: Analyze Goal
        addTrace('Intent Analysis', `Parsing objective: "${goalPrompt}"`);

        // 2. Fetch Relevant Regional Agronomy Skills
        let skillsContext = '';
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
                skillsContext = skillRows.map(s => `[Skill: ${s.title}] ${s.skill_markdown}`).join('\n\n');
                addTrace(
                    'Closed-Loop Knowledge Retrieval',
                    `Injected ${skillRows.length} regional agronomy skill card(s) from field reports.`
                );
            }
        } catch (err) {
            logger.warn('Failed to retrieve regional skills for campaign:', err);
        }

        // 3. Query Matching Farmer Cohort
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

        const { rows: farmers } = await query<any>(farmerSql, farmerParams);
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

        // 4. Synthesize Advisory Message via AI Provider
        let advisoryText = '';
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
            advisoryText = (aiResponse.text || '').trim();
            addTrace('Advisory Synthesis', 'Generated contextualized advisory message using LLM & regional skill cards.');
        } catch {
            advisoryText = `🌾 Agricultural Advisory Alert: Regarding ${goalPrompt}. Please inspect your crops, monitor soil moisture, and contact your extension officer for guidance.`;
            addTrace('Advisory Synthesis', 'Generated rule-based fallback advisory message.');
        }

        // 5. Multi-Channel Dispatching Loop
        let dispatchedMessagesCount = 0;
        for (const farmer of farmers) {
            const farmerPhone = farmer.phone;
            const farmerName = `${farmer.first_name || 'Farmer'} ${farmer.last_name || ''}`.trim();
            const personalizedMsg = `Hello ${farmerName},\n${advisoryText}`;

            try {
                if ((channel === 'all' || channel === 'sms') && farmerPhone) {
                    await smsService.sendSMS({
                        to: farmerPhone,
                        message: personalizedMsg,
                        farmerId: farmer.id,
                        senderId: userId || undefined,
                    });
                    dispatchedMessagesCount++;
                }

                if (channel === 'whatsapp' && farmerPhone) {
                    await whatsappService.sendMessage({
                        to: farmerPhone,
                        message: personalizedMsg,
                        farmerId: farmer.id,
                        senderId: userId || undefined,
                    });
                    dispatchedMessagesCount++;
                }

                if (channel === 'telegram' && farmer.notes?.includes('tg:')) {
                    const tgChatId = farmer.notes.match(/tg:(\d+)/)?.[1];
                    if (tgChatId) {
                        await telegramService.sendMessage({
                            chatId: tgChatId,
                            text: personalizedMsg,
                            farmerId: farmer.id,
                            senderId: userId || undefined,
                        });
                        dispatchedMessagesCount++;
                    }
                }
            } catch (dispatchErr) {
                logger.warn(`Failed to dispatch campaign message to farmer ${farmer.id}:`, dispatchErr);
            }
        }

        addTrace(
            'Multi-Channel Dispatch',
            `Dispatched ${dispatchedMessagesCount} broadcast messages across SMS, WhatsApp, and Telegram.`
        );

        // 6. Schedule Field Visits for At-Risk Farmers (vital_score < 65)
        let scheduledVisitsCount = 0;
        if (autoScheduleVisits) {
            const atRiskFarmers = farmers.filter(f => (f.vital_score || 80) < 65);
            for (const atRisk of atRiskFarmers) {
                try {
                    await query(
                        `INSERT INTO visits (
                            farmer_id, user_id, scheduled_date, status, notes, created_at, updated_at
                        ) VALUES ($1, $2, NOW() + INTERVAL '2 days', 'scheduled', $3, NOW(), NOW())`,
                        [
                            atRisk.id,
                            userId || (await this.getDefaultOfficerId(tenantId)),
                            `Autonomous Campaign Action Item: Inspect for ${goalPrompt} (Vital score: ${atRisk.vital_score})`,
                        ]
                    );
                    scheduledVisitsCount++;
                } catch (visitErr) {
                    logger.warn('Failed to queue automated field visit:', visitErr);
                }
            }

            if (scheduledVisitsCount > 0) {
                addTrace(
                    'Field Inspection Scheduling',
                    `Automatically queued ${scheduledVisitsCount} priority field inspection visits for at-risk farmers (Vital Score < 65).`
                );
            }
        }

        // 7. Persist Campaign Run
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
                    tenantId || null,
                    userId || null,
                    goalPrompt,
                    targetRegion || null,
                    targetCrop || null,
                    affectedFarmersCount,
                    dispatchedMessagesCount,
                    scheduledVisitsCount,
                    JSON.stringify(trace),
                    advisoryText,
                ]
            );
            if (rows[0]) campaignId = rows[0].id;
        } catch (saveErr) {
            logger.error('Failed to persist autonomous campaign run:', saveErr);
        }

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
