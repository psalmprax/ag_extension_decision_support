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
        timeline: any[];
        geography: any[];
        crops: any[];
        recentActivity: any[];
        priorityQueue: any[];
    };
}

export const fetchDashboardData = async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/analytics/dashboard');
    return response.data;
};
