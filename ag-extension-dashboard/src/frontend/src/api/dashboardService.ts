import apiClient from './client';

export interface DashboardOverview {
    totalFarmers: number;
    totalOfficers: number;
    activeConversations: number;
    visitsThisMonth: number;
    avgSatisfaction: number;
    queriesResolved: number;
    avgConversationsPerFarmer: number;
}

export interface DashboardTrends {
    farmersGrowth: number;
    conversationsGrowth: number;
    visitsGrowth: number;
    satisfactionChange: number;
}

export interface DashboardTimelineEntry {
    date: string;
    [metric: string]: string | number;
}

export interface DashboardGeographyEntry {
    region: string;
    farmers: number;
    officers: number;
}

export interface DashboardCropEntry {
    name: string;
    count: number;
}

export interface DashboardActivityEntry {
    type: string;
    description: string;
    time_diff: string;
}

export interface DashboardPriorityEntry {
    farmerId: string;
    name: string;
    reason: string;
    severity: string;
    crop: string;
}

export interface DashboardResponse {
    success: boolean;
    data: {
        overview: DashboardOverview;
        trends: DashboardTrends;
        timeline: DashboardTimelineEntry[];
        geography: DashboardGeographyEntry[];
        crops: DashboardCropEntry[];
        recentActivity: DashboardActivityEntry[];
        priorityQueue: DashboardPriorityEntry[];
    };
}

export const fetchDashboardData = async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/analytics/dashboard');
    return response.data;
};
