import {
  listQuarantinedDocuments,
  reviewQuarantinedDocument,
} from '../services/quarantineReviewService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() },
}));

const mockQuery = query as jest.Mock;

describe('Quarantine review (parole path for grounding quarantine)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('lists quarantined documents newest-first with a cap', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd1', title: 't', source: 's', sourceUrl: null, updatedAt: 'now' }] });
    const docs = await listQuarantinedDocuments();
    expect(docs).toHaveLength(1);
    // Scraped extracts and officers' uploads waiting for review.
    expect(mockQuery.mock.calls[0][0]).toContain("tags && ARRAY['unverified_scrape', 'pending_review']::text[]");
    expect(mockQuery.mock.calls[0][1]).toEqual([50]);
  });

  it('approves by removing exactly the quarantine tag', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const result = await reviewQuarantinedDocument('doc-1', 'approve', 'admin-1');
    expect(result).toEqual({ cleared: true, deleted: false });
    expect(mockQuery.mock.calls[0][0]).toContain("array_remove(array_remove(tags, 'unverified_scrape'), 'pending_review')");
    expect(mockQuery.mock.calls[0][1]).toEqual(['doc-1', 'admin-1']);
  });

  it('does not let the agronomist who approved advice in the review queue also approve it as a document', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 1 });
    const result = await reviewQuarantinedDocument('doc-3', 'approve', 'agronomist-1');
    expect(result).toEqual({ cleared: false, deleted: false, ownReviewedAdvice: true });
    expect(mockQuery.mock.calls[0][0]).toContain('r.reviewed_by::text = $2');
    expect(mockQuery.mock.calls[1][1]).toEqual(['doc-3', 'agronomist-1']);
  });

  it('rejects by deleting the poisoned row', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const result = await reviewQuarantinedDocument('doc-2', 'reject', 'admin-1');
    expect(result).toEqual({ cleared: false, deleted: true });
    expect(mockQuery.mock.calls[0][0]).toContain('DELETE FROM knowledge_articles');
  });

  it('reports not-found instead of succeeding silently', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 0 });
    const result = await reviewQuarantinedDocument('missing', 'approve', 'admin-1');
    expect(result).toEqual({ cleared: false, deleted: false });
  });

  it('rejects bad verdicts, missing ids, and anonymous reviewers (fail-closed)', async () => {
    await expect(reviewQuarantinedDocument('d', 'maybe' as never, 'admin-1')).rejects.toThrow(/verdict/);
    await expect(reviewQuarantinedDocument('', 'approve', 'admin-1')).rejects.toThrow(/document id/);
    await expect(reviewQuarantinedDocument('d', 'approve', '')).rejects.toThrow(/reviewer/);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
