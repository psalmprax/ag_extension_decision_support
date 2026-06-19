import apiClient from './client';

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
    const { data } = await apiClient.post<ShareResponse>('/shares', params);
    return data;
};
