import apiClient from './client';

export interface Report {
    id: string;
    type: string;
    title: string;
    generatedAt: string;
    status: string;
    content?: string;
    createdBy?: string;
    data: { content?: string; [key: string]: unknown };
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

export const downloadReport = async (reportId: string): Promise<Blob> => {
    const response = await apiClient.get(`/reporting/${reportId}/download`, {
        responseType: 'blob'
    });
    return response.data;
};

export const getReportContent = async (reportId: string): Promise<{ success: boolean; data: Report }> => {
    const response = await apiClient.get(`/reporting/${reportId}`);
    return response.data;
};
