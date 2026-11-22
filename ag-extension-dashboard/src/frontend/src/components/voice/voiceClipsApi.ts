import apiClient from '@/api/client';

export interface VoiceClip {
  id: string;
  key: string;
  language: string;
  title: string;
  transcript: string | null;
  url: string;
  /** Whether this person may replace or delete it: the one who recorded it, or an administrator. */
  canChange: boolean;
}

export interface VoiceLibrary {
  clips: VoiceClip[];
  prompts: Record<string, string>;
  callingConfigured: boolean;
  dailyCallLimit: number;
}

export async function fetchVoiceLibrary(): Promise<VoiceLibrary> {
  const { data } = await apiClient.get('/voice-clips');
  return data.data as VoiceLibrary;
}

export async function saveVoiceClip(input: { key: string; language: string; title: string; transcript?: string; uploadId: string }): Promise<void> {
  await apiClient.post('/voice-clips', input);
}

export async function deleteVoiceClip(id: string): Promise<void> {
  await apiClient.delete(`/voice-clips/${id}`);
}

export async function callWithClip(id: string, pilotId: string): Promise<{ queued: number; skipped: number }> {
  const { data } = await apiClient.post(`/voice-clips/${id}/call`, { pilotId });
  return data.data;
}
