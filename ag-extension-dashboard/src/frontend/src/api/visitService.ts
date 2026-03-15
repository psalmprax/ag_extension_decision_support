import apiClient from './client';

export interface Visit {
    id: string;
    farmer_id: string;
    farmer_name: string;
    visit_type: string;
    status: string;
    scheduled_at: string;
    notes?: string;
    outcomes?: string;
}

export interface VisitsResponse {
    success: boolean;
    data: {
        visits: Visit[];
        total: number;
    };
}

export const fetchVisits = async (): Promise<VisitsResponse> => {
    const response = await apiClient.get<VisitsResponse>('/visits');
    return response.data;
};
