import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import {
  listQuarantinedDocuments,
  reviewQuarantinedDocument,
  ReviewVerdict,
} from '@/services/quarantineReviewService';

const router = Router();

type AuthedRequest = Request & { user?: { userId?: string; id?: string } };

function reviewerId(req: AuthedRequest): string {
  return String(req.user?.userId || req.user?.id || 'unknown');
}

// Review queue is a governance function: admins and regional managers only.
router.get('/quarantine', authorize(['admin', 'regional_manager']), async (_req: Request, res: Response) => {
  try {
    const docs = await listQuarantinedDocuments();
    return res.json({ success: true, data: docs });
  } catch (error) {
    logger.error('Failed to list quarantined documents:', error);
    return safeError(res, 500, 'Failed to list quarantined documents');
  }
});

router.post('/quarantine/:id/clear', authorize(['admin', 'regional_manager']), async (req: AuthedRequest, res: Response) => {
  try {
    const { verdict } = req.body as { verdict?: ReviewVerdict };
    if (verdict !== 'approve' && verdict !== 'reject') {
      return res.status(400).json({ success: false, error: "verdict must be 'approve' or 'reject'" });
    }
    const result = await reviewQuarantinedDocument(req.params.id, verdict, reviewerId(req));
    if (!result.cleared && !result.deleted) {
      return res.status(404).json({ success: false, error: 'Document not found or not quarantined' });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to review quarantined document:', error);
    return safeError(res, 500, 'Failed to review quarantined document');
  }
});

export default router;
