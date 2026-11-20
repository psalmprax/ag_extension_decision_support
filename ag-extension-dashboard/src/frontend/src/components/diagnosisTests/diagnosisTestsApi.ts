import apiClient from '@/api/client';

export interface TestClass {
  crop: string;
  label: string;
  photos: number;
  fieldConfirmed: number;
  tested: number | null;
  correct: number | null;
}

export interface TestRun {
  id: string;
  status: 'running' | 'finished' | 'failed';
  total: number;
  done: number;
  correct: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface TestOverview {
  classes: TestClass[];
  runs: TestRun[];
  thresholds: { minSamples: number; minAccuracy: number; maxPhotosPerRun: number };
}

export interface TestMistake {
  imageId: string;
  crop: string;
  label: string;
  predicted: string | null;
  url: string;
}

export async function fetchTestOverview(): Promise<TestOverview> {
  const { data } = await apiClient.get('/diagnosis-tests');
  return data.data as TestOverview;
}

/** Add an uploaded photo to the test set with what it shows. */
export async function labelPhoto(input: { uploadId: string; crop: string; label: string }): Promise<void> {
  await apiClient.post('/diagnosis-tests/images', input);
}

export async function startTestRun(): Promise<{ id: string; total: number }> {
  const { data } = await apiClient.post('/diagnosis-tests/runs');
  return data.data;
}

export async function fetchMistakes(runId: string): Promise<TestMistake[]> {
  const { data } = await apiClient.get(`/diagnosis-tests/runs/${runId}/mistakes`);
  return data.data as TestMistake[];
}

export type ClassState = 'tested' | 'below_threshold' | 'not_tested' | 'needs_photos';

/** Where a class stands against the thresholds. */
export function classState(row: TestClass, minSamples: number, minAccuracy: number): ClassState {
  if (row.tested === null || row.correct === null) return row.photos < minSamples ? 'needs_photos' : 'not_tested';
  if (row.tested < minSamples) return 'needs_photos';
  return row.correct / row.tested >= minAccuracy ? 'tested' : 'below_threshold';
}
