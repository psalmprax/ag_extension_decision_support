import apiClient from '@/api/client';

export interface PendingGuide {
  id: string;
  title: string;
  source: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

/** Adds a guide (PDF, TXT or MD) to the knowledge base, tagged with its country. */
export async function uploadGuide(input: { file: File; title: string; crops: string; country: string }): Promise<{ pendingReview: boolean }> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.title) form.append('title', input.title);
  if (input.crops) form.append('crops', input.crops);
  if (input.country) form.append('country', input.country);
  const { data } = await apiClient.post('/knowledge/ingest', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 });
  return { pendingReview: Boolean(data?.data?.pendingReview) };
}

/** Guides waiting for a manager or administrator: officers' uploads and scraped web extracts. */
export async function listPendingGuides(): Promise<PendingGuide[]> {
  const { data } = await apiClient.get('/knowledge/quarantine');
  return (data?.data ?? []) as PendingGuide[];
}

export async function reviewGuide(id: string, verdict: 'approve' | 'reject'): Promise<void> {
  await apiClient.post(`/knowledge/quarantine/${id}/clear`, { verdict });
}

export interface ContentGapGroup {
  crop: string | null;
  country: string | null;
  questions: number;
  topWords: Array<{ word: string; count: number }>;
  examples: string[];
}

/** Questions answered without a vetted guide, by crop and country (last `days` days). */
export async function fetchContentGaps(days = 90): Promise<ContentGapGroup[]> {
  const { data } = await apiClient.get('/knowledge/content-gaps', { params: { days } });
  return (data?.data?.groups ?? []) as ContentGapGroup[];
}
