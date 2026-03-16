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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        byOfficer: any[];
    };
}

export const fetchPerformanceData = async (): Promise<PerformanceResponse> => {
    const response = await apiClient.get<PerformanceResponse>('/analytics/performance');
    return response.data;
};
