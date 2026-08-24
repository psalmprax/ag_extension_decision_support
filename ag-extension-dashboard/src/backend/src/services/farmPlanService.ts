import { query } from './databaseService';
import { logger } from '@/utils/logger';

export interface PlanMilestone {
    title: string;
    category: 'land_prep' | 'planting' | 'input' | 'scouting' | 'harvest' | 'post_harvest';
    offsetDays: number; // days from planting date
}

/**
 * Rule-based milestone templates per crop (days relative to planting).
 * Extension-agronomy defaults for the region's staple crops; refined by
 * officers over time as efficacy data accumulates.
 */
export const PLAN_TEMPLATES: Record<string, PlanMilestone[]> = {
    maize: [
        { title: 'Land preparation complete', category: 'land_prep', offsetDays: -7 },
        { title: 'Planting (with basal fertilizer)', category: 'planting', offsetDays: 0 },
        { title: 'First weeding', category: 'input', offsetDays: 21 },
        { title: 'Top-dress with nitrogen (knee-high)', category: 'input', offsetDays: 28 },
        { title: 'Fall armyworm scouting round 1', category: 'scouting', offsetDays: 21 },
        { title: 'Fall armyworm scouting round 2', category: 'scouting', offsetDays: 42 },
        { title: 'Second weeding', category: 'input', offsetDays: 45 },
        { title: 'Tasseling moisture check', category: 'scouting', offsetDays: 60 },
        { title: 'Harvest readiness assessment', category: 'harvest', offsetDays: 120 },
        { title: 'Harvest and shelling', category: 'harvest', offsetDays: 135 },
        { title: 'Post-harvest storage treatment', category: 'post_harvest', offsetDays: 140 },
    ],
    potato: [
        { title: 'Land preparation and ridging', category: 'land_prep', offsetDays: -7 },
        { title: 'Plant certified seed', category: 'planting', offsetDays: 0 },
        { title: 'Late blight scouting round 1', category: 'scouting', offsetDays: 21 },
        { title: 'Second ridging', category: 'input', offsetDays: 28 },
        { title: 'Late blight protective spray window', category: 'input', offsetDays: 35 },
        { title: 'Late blight scouting round 2', category: 'scouting', offsetDays: 49 },
        { title: 'Harvest', category: 'harvest', offsetDays: 95 },
        { title: 'Curing and storage', category: 'post_harvest', offsetDays: 100 },
    ],
    soybean: [
        { title: 'Land preparation', category: 'land_prep', offsetDays: -7 },
        { title: 'Planting (inoculated seed)', category: 'planting', offsetDays: 0 },
        { title: 'First weeding', category: 'input', offsetDays: 21 },
        { title: 'Pest scouting', category: 'scouting', offsetDays: 40 },
        { title: 'Harvest', category: 'harvest', offsetDays: 100 },
    ],
    groundnut: [
        { title: 'Land preparation', category: 'land_prep', offsetDays: -7 },
        { title: 'Planting', category: 'planting', offsetDays: 0 },
        { title: 'First weeding', category: 'input', offsetDays: 21 },
        { title: 'Rust scouting', category: 'scouting', offsetDays: 50 },
        { title: 'Harvest', category: 'harvest', offsetDays: 110 },
        { title: 'Drying and aflatoxin-safe storage', category: 'post_harvest', offsetDays: 118 },
    ],
};

const DEFAULT_TEMPLATE: PlanMilestone[] = PLAN_TEMPLATES.maize;

export function milestonesForCrop(crop: string, plantingDate: Date): { title: string; category: string; dueDate: Date; sortOrder: number }[] {
    const key = Object.keys(PLAN_TEMPLATES).find(k => crop.toLowerCase().includes(k));
    const template = key ? PLAN_TEMPLATES[key] : DEFAULT_TEMPLATE;
    return template.map((m, idx) => ({
        title: m.title,
        category: m.category,
        dueDate: new Date(plantingDate.getTime() + m.offsetDays * 86400_000),
        sortOrder: idx,
    }));
}

interface CycleRow {
    id: string;
    crop_name: string;
    planting_date: Date | null;
}

export const farmPlanService = {
    /**
     * Generate (or regenerate) a milestone plan for a crop cycle.
     */
    async generatePlan(cropCycleId: string): Promise<{ milestones: number; crop: string }> {
        const { rows } = await query<CycleRow>(
            'SELECT id, crop_name, planting_date FROM crop_cycles WHERE id = $1',
            [cropCycleId]
        );
        if (rows.length === 0) throw new Error('CROP_CYCLE_NOT_FOUND');

        const cycle = rows[0];
        const plantingDate = cycle.planting_date ? new Date(cycle.planting_date) : new Date();
        const milestones = milestonesForCrop(cycle.crop_name, plantingDate);

        await query('DELETE FROM crop_cycle_milestones WHERE crop_cycle_id = $1', [cropCycleId]);
        for (const m of milestones) {
            await query(
                `INSERT INTO crop_cycle_milestones (crop_cycle_id, title, category, due_date, sort_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [cropCycleId, m.title, m.category, m.dueDate.toISOString().slice(0, 10), m.sortOrder]
            );
        }
        await query(
            'UPDATE crop_cycles SET plan_json = $1, plan_generated_at = NOW() WHERE id = $2',
            [JSON.stringify({ generatedFor: cycle.crop_name, milestoneCount: milestones.length }), cropCycleId]
        );
        logger.info(`Farm plan generated for cycle ${cropCycleId}: ${milestones.length} milestones`);
        return { milestones: milestones.length, crop: cycle.crop_name };
    },

    async getPlan(cropCycleId: string) {
        const { rows } = await query<{
            id: string;
            title: string;
            category: string;
            due_date: Date | null;
            status: string;
            completed_at: Date | null;
            sort_order: number;
        }>(
            `SELECT id, title, category, due_date, status, completed_at, sort_order
             FROM crop_cycle_milestones WHERE crop_cycle_id = $1 ORDER BY sort_order`,
            [cropCycleId]
        );
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
            dueDate: r.due_date,
            status: r.status,
            completedAt: r.completed_at,
        }));
    },

    async setMilestoneStatus(milestoneId: string, status: 'pending' | 'done' | 'missed', notes?: string) {
        await query(
            `UPDATE crop_cycle_milestones SET status = $1, completed_at = $2, notes = COALESCE($3, notes) WHERE id = $4`,
            [status, status === 'done' ? new Date() : null, notes || null, milestoneId]
        );
    },
};
