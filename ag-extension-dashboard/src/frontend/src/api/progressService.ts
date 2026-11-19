import apiClient from './client';
import type { ChatAttachment } from '@/types/dashboard';

/** What an officer records about a farmer's progress. */
export type ProgressKind = 'success' | 'failure' | 'field_event' | 'action' | 'observation';

export interface ProgressEntry {
  id: string;
  farmerId: string;
  officerId: string | null;
  officerName: string | null;
  visitId: string | null;
  kind: ProgressKind;
  title: string;
  details: string | null;
  crop: string | null;
  /** YYYY-MM-DD */
  occurredOn: string;
  createdAt: string | null;
  attachments: ChatAttachment[];
}

export interface NewProgressEntry {
  kind: ProgressKind;
  title: string;
  details?: string;
  crop?: string;
  occurredOn: string;
  visitId?: string;
  attachmentIds?: string[];
}

export const fetchProgress = async (farmerId: string): Promise<ProgressEntry[]> => {
  const { data } = await apiClient.get<{ success: boolean; data: ProgressEntry[] }>(`/farmers/${farmerId}/progress`);
  return data.data ?? [];
};

export const recordProgress = async (farmerId: string, entry: NewProgressEntry): Promise<ProgressEntry> => {
  const { data } = await apiClient.post<{ success: boolean; data: ProgressEntry }>(`/farmers/${farmerId}/progress`, entry);
  return data.data;
};
