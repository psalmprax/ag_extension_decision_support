/**
 * Quarantine review — the exit path for grounding quarantine.
 *
 * Scraped web extracts enter `knowledge_articles` tagged `unverified_scrape`, and
 * guides uploaded by officers enter tagged `pending_review`; both are excluded from
 * RAG grounding (see groundingPolicy) until a manager or administrator clears them. Approve removes the tag (document becomes groundable);
 * reject deletes the row (poisoned/misleading source removed entirely).
 * Every decision is logged with the reviewer identity.
 */
import { query } from './databaseService';
import { logger } from '../utils/logger';

export interface QuarantinedDocument {
  id: string;
  title: string;
  source: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

export type ReviewVerdict = 'approve' | 'reject';

export interface QuarantineReviewResult {
  cleared: boolean;
  deleted: boolean;
  /** Set when the approver is the agronomist who approved this advice in the review queue. */
  ownReviewedAdvice?: boolean;
}

export async function listQuarantinedDocuments(limit = 50): Promise<QuarantinedDocument[]> {
  const capped = Math.min(Math.max(limit, 1), 200);
  const res = await query(
    `SELECT id, title, source, source_url AS "sourceUrl", updated_at AS "updatedAt"
     FROM knowledge_articles
     WHERE tags && ARRAY['unverified_scrape', 'pending_review']::text[]
     ORDER BY updated_at DESC
     LIMIT $1`,
    [capped],
  );
  return res.rows as QuarantinedDocument[];
}

async function approvedTheAdvice(articleId: string, reviewerId: string): Promise<boolean> {
  const res = await query(
    'SELECT 1 FROM recommendation_reviews WHERE knowledge_article_id::text = $1 AND reviewed_by::text = $2 LIMIT 1',
    [articleId, reviewerId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function reviewQuarantinedDocument(
  id: string,
  verdict: ReviewVerdict,
  reviewerId: string,
): Promise<QuarantineReviewResult> {
  if (!id || typeof id !== 'string') throw new Error('reviewQuarantinedDocument requires a document id');
  if (verdict !== 'approve' && verdict !== 'reject') {
    throw new Error(`reviewQuarantinedDocument requires verdict 'approve'|'reject', got '${verdict}'`);
  }
  if (!reviewerId) throw new Error('reviewQuarantinedDocument requires a reviewer identity');

  if (verdict === 'approve') {
    // Four eyes: advice added from the review queue needs someone other than the agronomist
    // who approved it to approve the document.
    const res = await query(
      `UPDATE knowledge_articles
       SET tags = array_remove(array_remove(tags, 'unverified_scrape'), 'pending_review'), updated_at = NOW()
       WHERE id = $1 AND tags && ARRAY['unverified_scrape', 'pending_review']::text[]
         AND NOT EXISTS (
           SELECT 1 FROM recommendation_reviews r
           WHERE r.knowledge_article_id = knowledge_articles.id AND r.reviewed_by::text = $2
         )`,
      [id, reviewerId],
    );
    const cleared = (res.rowCount ?? 0) > 0;
    if (!cleared && (await approvedTheAdvice(id, reviewerId))) {
      logger.warn(`Quarantine approval of ${id} refused: ${reviewerId} approved this advice in the review queue`);
      return { cleared: false, deleted: false, ownReviewedAdvice: true };
    }
    logger.info(`Quarantine ${cleared ? 'cleared' : 'already clear/missing'} for ${id} by reviewer ${reviewerId}`);
    return { cleared, deleted: false };
  }

  const res = await query(
    `DELETE FROM knowledge_articles WHERE id = $1 AND tags && ARRAY['unverified_scrape', 'pending_review']::text[]`,
    [id],
  );
  const deleted = (res.rowCount ?? 0) > 0;
  logger.info(`Quarantined document ${deleted ? 'deleted' : 'already clear/missing'} for ${id} by reviewer ${reviewerId}`);
  return { cleared: false, deleted };
}
