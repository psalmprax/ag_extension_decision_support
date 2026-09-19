/**
 * Quarantine review — the exit path for grounding quarantine.
 *
 * Scraped web extracts enter `knowledge_articles` tagged `unverified_scrape`
 * and are excluded from RAG grounding (see groundingPolicy) until a human
 * reviewer clears them. Approve removes the tag (document becomes groundable);
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

export async function listQuarantinedDocuments(limit = 50): Promise<QuarantinedDocument[]> {
  const capped = Math.min(Math.max(limit, 1), 200);
  const res = await query(
    `SELECT id, title, source, source_url AS "sourceUrl", updated_at AS "updatedAt"
     FROM knowledge_articles
     WHERE 'unverified_scrape' = ANY(tags)
     ORDER BY updated_at DESC
     LIMIT $1`,
    [capped],
  );
  return res.rows as QuarantinedDocument[];
}

export async function reviewQuarantinedDocument(
  id: string,
  verdict: ReviewVerdict,
  reviewerId: string,
): Promise<{ cleared: boolean; deleted: boolean }> {
  if (!id || typeof id !== 'string') throw new Error('reviewQuarantinedDocument requires a document id');
  if (verdict !== 'approve' && verdict !== 'reject') {
    throw new Error(`reviewQuarantinedDocument requires verdict 'approve'|'reject', got '${verdict}'`);
  }
  if (!reviewerId) throw new Error('reviewQuarantinedDocument requires a reviewer identity');

  if (verdict === 'approve') {
    const res = await query(
      `UPDATE knowledge_articles
       SET tags = array_remove(tags, 'unverified_scrape'), updated_at = NOW()
       WHERE id = $1 AND 'unverified_scrape' = ANY(tags)`,
      [id],
    );
    const cleared = (res.rowCount ?? 0) > 0;
    logger.info(`Quarantine ${cleared ? 'cleared' : 'already clear/missing'} for ${id} by reviewer ${reviewerId}`);
    return { cleared, deleted: false };
  }

  const res = await query(
    `DELETE FROM knowledge_articles WHERE id = $1 AND 'unverified_scrape' = ANY(tags)`,
    [id],
  );
  const deleted = (res.rowCount ?? 0) > 0;
  logger.info(`Quarantined document ${deleted ? 'deleted' : 'already clear/missing'} for ${id} by reviewer ${reviewerId}`);
  return { cleared: false, deleted };
}
