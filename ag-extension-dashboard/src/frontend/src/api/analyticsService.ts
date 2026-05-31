import apiClient from './client';

export interface PerformanceResponse {
    success: boolean;
    data: {
        metrics: {
            avgResponseTime: number;
            resolutionRate: number;
            satisfactionScore: number;
            followUpRate: number;
            firstContactResolution: number;
        };
        timeline: Array<Record<string, string | number>>;
        byOfficer: Array<Record<string, string | number>>;
    };
}

export const fetchPerformanceData = async (): Promise<PerformanceResponse> => {
    const response = await apiClient.get<PerformanceResponse>('/analytics/performance');
    return response.data;
};
