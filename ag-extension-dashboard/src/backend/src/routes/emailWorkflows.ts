import { Router, Request, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { emailWorkflowListSchema, updateEmailTemplateSchema } from '@/utils/schemas';
import { emailWorkflowService } from '@/services/emailWorkflowService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.get('/templates', authorize(['extension_officer', 'admin', 'farmer']), validate(emailWorkflowListSchema), async (req: Request, res: Response) => {
    try {
        const category = req.query.category as string | undefined;
        const templates = await emailWorkflowService.getTemplates(category);
        res.json({ success: true, data: templates });
    } catch (error) {
        logger.error('Failed to get email templates:', error);
        safeError(res, 500, 'Failed to get email templates');
    }
});

router.put('/templates/:id', authorize(['admin', 'extension_officer']), validate(updateEmailTemplateSchema), async (req: Request, res: Response) => {
    try {
        const { subject, body, category, variables } = req.body;
        const success = await emailWorkflowService.updateTemplate(req.params.id, { subject, body, category, variables });
        if (success) {
            res.json({ success: true, message: 'Template updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Template not found' });
        }
    } catch (error) {
        logger.error('Failed to update email template:', error);
        safeError(res, 500, 'Failed to update email template');
    }
});

router.get('/approvals/pending', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const approvals = await emailWorkflowService.getPendingApprovals();
        res.json({ success: true, data: approvals });
    } catch (error) {
        logger.error('Failed to get pending approvals:', error);
        safeError(res, 500, 'Failed to get pending approvals');
    }
});

router.post('/approvals/:id/approve', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const success = await emailWorkflowService.reviewApproval(req.params.id, 'approved', (req as AuthRequest).user!.userId, comment);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to approve email:', error);
        safeError(res, 500, 'Failed to approve email');
    }
});

router.post('/approvals/:id/reject', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const success = await emailWorkflowService.reviewApproval(req.params.id, 'rejected', (req as AuthRequest).user!.userId, comment);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to reject email:', error);
        safeError(res, 500, 'Failed to reject email');
    }
});

export default router;
