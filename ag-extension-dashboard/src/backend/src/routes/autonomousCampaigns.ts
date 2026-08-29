import { Router, Request, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { autonomousCampaignService } from '@/services/autonomousCampaignService';
import { regionalSkillService } from '@/services/regionalSkillService';
import { getOutreachDeliveryStats, retryOutreachMessages } from '@/workers/outreachWorker';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

async function resolveTenantId(req: Request): Promise<string | null> {
    if (!req.user?.userId) return null;
    const requestedTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId : null;
    if (req.user.role === 'admin' && requestedTenant) return requestedTenant;
    return getPrincipalTenantId(req.user.userId);
}

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * POST /api/campaigns/goal — Execute an autonomous goal-driven campaign
 */
router.post('/goal', async (req: AuthRequest, res: Response) => {
    try {
        const { goalPrompt, targetRegion, targetCrop, channel, autoScheduleVisits } = req.body;
        if (!goalPrompt || typeof goalPrompt !== 'string') {
            return res.status(400).json({ success: false, error: 'goalPrompt is required' });
        }

        const tenantId = await resolveTenantId(req);
        const result = await autonomousCampaignService.executeGoalCampaign({
            goalPrompt,
            targetRegion,
            targetCrop,
            channel,
            autoScheduleVisits: autoScheduleVisits !== false,
            tenantId,
            userId: req.user?.userId,
        });

        return res.json(result);
    } catch (error) {
        logger.error('Goal campaign execution failed:', error);
        return safeError(res, 500, 'Goal campaign execution failed');
    }
});

/**
 * GET /api/campaigns/outreach-stats — Delivery status of the outreach queue
 */
router.get('/outreach-stats', async (_req: Request, res: Response) => {
    try {
        const stats = await getOutreachDeliveryStats();
        return res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Failed to fetch outreach delivery stats:', error);
        return safeError(res, 500, 'Failed to fetch outreach delivery stats');
    }
});

/**
 * POST /api/campaigns/outreach-stats/retry — Requeue failed outreach messages
 */
router.post('/outreach-stats/retry', async (req: AuthRequest, res: Response) => {
    try {
        const { ids } = req.body ?? {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.some((id: unknown) => typeof id !== 'string')) {
            return res.status(400).json({ success: false, error: 'ids must be a non-empty array of strings' });
        }
        const requeued = await retryOutreachMessages(ids as string[]);
        return res.json({ success: true, data: { requeued } });
    } catch (error) {
        logger.error('Failed to retry outreach messages:', error);
        return safeError(res, 500, 'Failed to retry outreach messages');
    }
});

/**
 * GET /api/campaigns/history — Get past autonomous campaign executions
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const tenantId = await resolveTenantId(req);
        const history = await autonomousCampaignService.getCampaignHistory(tenantId);
        return res.json({ success: true, data: history });
    } catch (error) {
        logger.error('Failed to fetch campaign history:', error);
        return safeError(res, 500, 'Failed to fetch campaign history');
    }
});

/**
 * GET /api/campaigns/skills — Get Regional Agronomy Skill Cards
 */
router.get('/skills', async (req: Request, res: Response) => {
    try {
        const tenantId = await resolveTenantId(req);
        const region = typeof req.query.region === 'string' ? req.query.region : undefined;
        const crop = typeof req.query.crop === 'string' ? req.query.crop : undefined;

        const skills = await regionalSkillService.getSkills({
            region,
            crop,
            tenantId,
        });
        return res.json({ success: true, data: skills });
    } catch (error) {
        logger.error('Failed to fetch regional skills:', error);
        return safeError(res, 500, 'Failed to fetch regional skills');
    }
});

/**
 * POST /api/campaigns/skills/synthesize — Synthesize a skill from field visit notes
 */
router.post('/skills/synthesize', async (req: AuthRequest, res: Response) => {
    try {
        const { visitId, region, crop, topic, findings, officerNotes } = req.body;
        if (!region || !crop || !topic || !findings) {
            return res.status(400).json({ success: false, error: 'region, crop, topic, and findings are required' });
        }

        const tenantId = await resolveTenantId(req);
        const skill = await regionalSkillService.synthesizeSkillFromVisit({
            visitId,
            region,
            crop,
            topic,
            findings,
            officerNotes,
            officerId: req.user?.userId,
            tenantId,
        });

        return res.json({ success: true, data: skill });
    } catch (error) {
        logger.error('Failed to synthesize regional skill:', error);
        return safeError(res, 500, 'Failed to synthesize regional skill');
    }
});

/**
 * POST /api/campaigns/skills — Create manual skill card
 */
router.post('/skills', authorize(['admin', 'regional_manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { region, crop, topic, title, skillMarkdown, confidenceScore } = req.body;
        if (!region || !crop || !topic || !title || !skillMarkdown) {
            return res.status(400).json({ success: false, error: 'region, crop, topic, title, and skillMarkdown are required' });
        }

        const tenantId = await resolveTenantId(req);
        const skill = await regionalSkillService.createSkill({
            region,
            crop,
            topic,
            title,
            skillMarkdown,
            sourceType: 'manual',
            createdBy: req.user?.userId,
            tenantId,
            confidenceScore,
        });

        return res.json({ success: true, data: skill });
    } catch (error) {
        logger.error('Failed to create regional skill:', error);
        return safeError(res, 500, 'Failed to create regional skill');
    }
});

export default router;
