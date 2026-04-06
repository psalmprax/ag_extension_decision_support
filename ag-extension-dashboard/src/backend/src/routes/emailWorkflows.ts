import { Router, Request, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { emailWorkflowService } from '@/services/emailWorkflowService';
import { logger } from '@/utils/logger';

const router = Router();

router.get('/templates', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    try {
        const category = req.query.category as string | undefined;
        const templates = await emailWorkflowService.getTemplates(category);
        res.json({ success: true, data: templates });
    } catch (error) {
        logger.error('Failed to get email templates:', error);
        res.status(500).json({ success: false, error: 'Failed to get email templates' });
    }
});

router.get('/approvals/pending', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    try {
        const approvals = await emailWorkflowService.getPendingApprovals();
        res.json({ success: true, data: approvals });
    } catch (error) {
        logger.error('Failed to get pending approvals:', error);
        res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
    }
});

router.post('/approvals/:id/approve', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const success = await emailWorkflowService.reviewApproval(req.params.id, 'approved', (req as AuthRequest).user!.userId, comment);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to approve email:', error);
        res.status(500).json({ success: false, error: 'Failed to approve email' });
    }
});

router.post('/approvals/:id/reject', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const success = await emailWorkflowService.reviewApproval(req.params.id, 'rejected', (req as AuthRequest).user!.userId, comment);
        res.json({ success });
    } catch (error) {
        logger.error('Failed to reject email:', error);
        res.status(500).json({ success: false, error: 'Failed to reject email' });
    }
});

export default router;
