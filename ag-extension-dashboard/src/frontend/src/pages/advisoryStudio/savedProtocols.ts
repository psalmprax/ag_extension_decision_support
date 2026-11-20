import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

export interface SavedProtocol {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: 'draft' | 'published';
  version: number;
  stepsJson: unknown[];
  updatedAt: string;
}

export const SAVED_PROTOCOLS_KEY = ['advisory-workflows'];

/** Protocols saved by this organisation, newest first. */
export function useSavedProtocols() {
  return useQuery({
    queryKey: SAVED_PROTOCOLS_KEY,
    queryFn: async () => (await apiClient.get<{ data: SavedProtocol[] }>('/workflows')).data.data,
  });
}
