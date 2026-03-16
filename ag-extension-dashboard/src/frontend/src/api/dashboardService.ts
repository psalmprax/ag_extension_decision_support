import apiClient from './client';

export interface DashboardOverview {
    totalFarmers: number;
    totalOfficers: number;
    activeConversations: number;
    visitsThisMonth: number;
    avgSatisfaction: number;
    queriesResolved: number;
}

export interface DashboardTrends {
    farmersGrowth: number;
    conversationsGrowth: number;
    visitsGrowth: number;
    satisfactionChange: number;
}

export interface DashboardResponse {
    success: boolean;
    data: {
        overview: DashboardOverview;
        trends: DashboardTrends;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeline: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geography: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        crops: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recentActivity: any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priorityQueue: any[];
    };
}

export const fetchDashboardData = async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/analytics/dashboard');
    return response.data;
};
