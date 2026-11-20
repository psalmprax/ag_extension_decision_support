import apiClient from '@/api/client';

export interface Pilot {
  id: string;
  name: string;
  region: string;
  country: string | null;
  crop: string;
  season_start: string;
  season_end: string;
  comparison_share: number;
  bag_kg: number;
  status: 'draft' | 'running' | 'closed';
}

export interface ArmResult {
  farmers: number;
  withBothHarvests: number;
  baselineKgPerHa: number | null;
  endlineKgPerHa: number | null;
  meanChangeKgPerHa: number | null;
  medianReplyMinutes: number | null;
  followups: { asked: number; yes: number; partly: number; no: number };
}

export interface PilotDetail {
  pilot: Pilot;
  results: {
    service: ArmResult;
    comparison: ArmResult;
    difference: { kgPerHa: number; low: number; high: number } | null;
    tooEarly: boolean;
  };
  minPerGroup: number;
}

export interface PilotInput {
  name: string;
  region: string;
  country?: string;
  crop: string;
  seasonStart: string;
  seasonEnd: string;
  comparisonShare?: number;
  bagKg?: number;
}

export async function fetchPilots(): Promise<Pilot[]> {
  const { data } = await apiClient.get('/pilots');
  return data.data as Pilot[];
}

export async function fetchPilot(id: string): Promise<PilotDetail> {
  const { data } = await apiClient.get(`/pilots/${id}`);
  return data.data as PilotDetail;
}

export async function createPilot(input: PilotInput): Promise<Pilot> {
  const { data } = await apiClient.post('/pilots', input);
  return data.data as Pilot;
}

export async function startPilot(id: string): Promise<{ service: number; comparison: number }> {
  const { data } = await apiClient.post(`/pilots/${id}/start`);
  return data.data;
}

export async function closePilot(id: string): Promise<void> {
  await apiClient.post(`/pilots/${id}/close`);
}

export async function askHarvest(id: string, which: 'baseline' | 'endline'): Promise<Record<'sent' | 'opted_out' | 'no_contact' | 'failed', number>> {
  const { data } = await apiClient.post(`/pilots/${id}/ask-harvest`, { which });
  return data.data;
}

/** The farmer-level file for an evaluator (no names or phone numbers), saved through the browser. */
export async function downloadPilotCsv(pilot: Pilot): Promise<void> {
  const { data } = await apiClient.get(`/pilots/${pilot.id}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pilot-${pilot.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** The error message the server gave, if any. */
export function serverMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error;
}
