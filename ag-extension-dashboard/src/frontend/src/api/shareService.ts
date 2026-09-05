import apiClient from './client';
import { isDemoId } from '@/demo/demoIds';

export interface CreateShareParams {
  entityType: string;
  entityId: string;
  accessType: string;
  expiresInDays: number;
  permissions: {
    canView: boolean;
    canExport: boolean;
  };
}

export interface ShareResponse {
  success: boolean;
  data?: {
    shareId: string;
    shareUrl: string;
    expiresAt?: string;
    accessType: string;
  };
  error?: string;
}

export const createShare = async (params: CreateShareParams): Promise<ShareResponse> => {
  if (isDemoId(params.entityId)) {
    const shareId = `demo-share-${params.entityType}-${Date.now().toString(36)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.gpexts.com';
    return {
      success: true,
      data: {
        shareId,
        shareUrl: `${origin}/share/${shareId}`,
        accessType: params.accessType,
        expiresAt: new Date(Date.now() + (params.expiresInDays || 7) * 86400000).toISOString(),
      },
    };
  }

  const { data } = await apiClient.post<ShareResponse>('/shares', params);
  return data;
};
