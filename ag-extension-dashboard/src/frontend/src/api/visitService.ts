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

export const fetchVisitsByFarmer = async (farmerId: string): Promise<VisitsResponse> => {
    const response = await apiClient.get<VisitsResponse>(`/visits?farmerId=${farmerId}`);
    return response.data;
};

export const fetchSynthesis = async (farmerId: string, notes: string): Promise<{ success: boolean; data: { summary: string } }> => {
    const response = await apiClient.post('/chatbot/synthesis', { farmerId, notes });
    return response.data;
};

export const createVisit = async (data: Partial<Visit>): Promise<{ success: boolean; data: Visit }> => {
    const response = await apiClient.post('/visits', data);
    return response.data;
};

export const updateVisit = async (id: string, data: Partial<Visit>): Promise<{ success: boolean; data: Visit }> => {
    const response = await apiClient.patch(`/visits/${id}`, data);
    return response.data;
};
