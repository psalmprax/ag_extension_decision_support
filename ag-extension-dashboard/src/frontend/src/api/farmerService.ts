import apiClient from './client';

export interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    region?: string;
    village?: string;
    crops?: string[];
    farmSize?: number;
    vitalScore?: number;
    yieldHistory?: any;
    locationLat?: number;
    locationLng?: number;
    languagePreference?: string;
}

export interface FarmersResponse {
    success: boolean;
    data: {
        farmers: Farmer[];
        total: number;
    };
}

export const fetchFarmers = async (): Promise<FarmersResponse> => {
    const response = await apiClient.get<FarmersResponse>('/farmers');
    return response.data;
};

export const createFarmer = async (farmer: Partial<Farmer>): Promise<{ success: boolean; data: Farmer }> => {
    const response = await apiClient.post<{ success: boolean; data: Farmer }>('/farmers', farmer);
    return response.data;
};

export interface FarmerStats {
    crops: string[];
    farmSize: number;
    vitalScore: number;
    yieldHistory: any[];
    soilMoisture: string;
    avgTemp: string;
    phLevel: string;
    aiConfidence: string;
    nextVisitDate?: string;
    aiTipsCount?: number;
    alertsCount?: number;
}

export interface FarmerStatsResponse {
    success: boolean;
    data: FarmerStats;
}

export const fetchFarmerStats = async (): Promise<FarmerStatsResponse> => {
    const response = await apiClient.get<FarmerStatsResponse>('/analytics/farmer-stats');
    return response.data;
};

export const updateFarmer = async (id: string, updates: Partial<Farmer>): Promise<{ success: boolean; data: Farmer }> => {
    const response = await apiClient.patch<{ success: boolean; data: Farmer }>(`/farmers/${id}`, updates);
    return response.data;
};

export const deleteFarmer = async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(`/farmers/${id}`);
    return response.data;
};

export const fetchFarmerById = async (id: string): Promise<{ success: boolean; data: Farmer }> => {
    const response = await apiClient.get<{ success: boolean; data: Farmer }>(`/farmers/${id}`);
    return response.data;
};
