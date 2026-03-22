import apiClient from './client';

export interface Report {
    id: string;
    type: string;
    title: string;
    generatedAt: string;
    status: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const generateReport = async (type: string, title?: string, farmerId?: string) => {
    const response = await apiClient.post('/reporting/generate', {
        type,
        title,
        farmerId,
    });
    return response.data;
};
