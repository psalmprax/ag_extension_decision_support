/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from './databaseService';
import { logger } from '../utils/logger';
import { AIProviderFactory } from './aiProvider/aiProvider';
import type { RegionalAgronomySkillRow } from '../types/rowTypes';

interface CreateSkillInput {
    region: string;
    crop: string;
    topic: string;
    title: string;
    skillMarkdown: string;
    sourceType?: 'field_visit' | 'officer_override' | 'manual';
    sourceVisitId?: string | null;
    createdBy?: string | null;
    tenantId?: string | null;
    confidenceScore?: number;
}

class RegionalSkillService {
    /**
     * Synthesize and store a new Regional Agronomy Skill Card from a field visit or diagnosis
     */
    async synthesizeSkillFromVisit(params: {
        visitId?: string;
        region: string;
        crop: string;
        topic: string;
        findings: string;
        officerNotes?: string;
        officerId?: string;
        tenantId?: string | null;
    }): Promise<RegionalAgronomySkillRow | null> {
        const { visitId, region, crop, topic, findings, officerNotes, officerId, tenantId } = params;

        let skillMarkdown = '';
        let title = `${topic} Management in ${region}`;

        try {
            const ai = await AIProviderFactory.getProvider();
            const prompt = `You are a Senior Agronomist summarizing field evidence into a reusable Regional Agronomy Skill Card.
Region: ${region}
Crop: ${crop}
Target Issue / Topic: ${topic}
Field Findings: ${findings}
Extension Officer Observations: ${officerNotes || 'Standard field observation'}

Create a structured markdown skill card containing:
1. Short Title
2. Field Context & Local Symptom Indicators
3. Validated Treatment / Cultural Practices
4. Timing & Local Caveats

Keep it factual, concise, and immediately applicable to future advisory generation.`;

            const generated = await ai.generateText(prompt);
            skillMarkdown = (generated.text || '').trim();
            title = `${topic} Protocol (${region})`;
        } catch {
            skillMarkdown = `### ${topic} in ${crop} (${region})\n\n**Field Observation:** ${findings}\n\n**Recommendation:** ${officerNotes || 'Follow integrated pest management protocols.'}`;
        }

        try {
            const { rows } = await query<RegionalAgronomySkillRow>(
                `INSERT INTO regional_agronomy_skills (
                    tenant_id, region, crop, topic, title, skill_markdown,
                    source_type, source_visit_id, created_by, confidence_score, usage_count
                ) VALUES ($1, $2, $3, $4, $5, $6, 'field_visit', $7, $8, 0.95, 0)
                RETURNING *`,
                [
                    tenantId || null,
                    region,
                    crop,
                    topic,
                    title,
                    skillMarkdown,
                    visitId || null,
                    officerId || null,
                ]
            );

            logger.info(`Synthesized new regional skill card for ${region}/${crop}: "${title}"`);
            return rows[0] || null;
        } catch (error) {
            logger.error('Failed to persist synthesized regional skill:', error);
            return null;
        }
    }

    /**
     * Fetch list of regional skills with optional filtering
     */
    async getSkills(options: {
        region?: string;
        crop?: string;
        tenantId?: string | null;
        limit?: number;
    }): Promise<RegionalAgronomySkillRow[]> {
        try {
            const { region, crop, tenantId, limit = 50 } = options;
            let sql = `SELECT * FROM regional_agronomy_skills WHERE 1=1`;
            const params: any[] = [];

            if (tenantId) {
                params.push(tenantId);
                sql += ` AND (tenant_id = $${params.length} OR tenant_id IS NULL)`;
            }
            if (region && region !== 'all') {
                params.push(`%${region}%`);
                sql += ` AND region ILIKE $${params.length}`;
            }
            if (crop && crop !== 'all') {
                params.push(`%${crop}%`);
                sql += ` AND crop ILIKE $${params.length}`;
            }

            sql += ` ORDER BY confidence_score DESC, updated_at DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            const { rows } = await query<RegionalAgronomySkillRow>(sql, params);
            return rows;
        } catch (error) {
            logger.error('Failed to get regional agronomy skills:', error);
            return [];
        }
    }

    /**
     * Create manual skill card
     */
    async createSkill(input: CreateSkillInput): Promise<RegionalAgronomySkillRow | null> {
        try {
            const {
                region,
                crop,
                topic,
                title,
                skillMarkdown,
                sourceType = 'manual',
                sourceVisitId,
                createdBy,
                tenantId,
                confidenceScore = 0.90,
            } = input;

            const { rows } = await query<RegionalAgronomySkillRow>(
                `INSERT INTO regional_agronomy_skills (
                    tenant_id, region, crop, topic, title, skill_markdown,
                    source_type, source_visit_id, created_by, confidence_score
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
                [
                    tenantId || null,
                    region,
                    crop,
                    topic,
                    title,
                    skillMarkdown,
                    sourceType,
                    sourceVisitId || null,
                    createdBy || null,
                    confidenceScore,
                ]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Failed to create manual agronomy skill:', error);
            return null;
        }
    }
}

export const regionalSkillService = new RegionalSkillService();
