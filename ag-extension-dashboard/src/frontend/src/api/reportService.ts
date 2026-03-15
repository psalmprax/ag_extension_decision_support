import apiClient from './client';

export interface Report {
    id: string;
    type: string;
    title: string;
    generatedAt: string;
    status: string;
    data: any;
}

export interface ReportsResponse {
    success: boolean;
    data: {
        reports: Report[];
        total: number;
    };
}

export const fetchReports = async (): Promise<ReportsResponse> => {
    const response = await apiClient.get<ReportsResponse>('/reporting');
    return response.data;
};
