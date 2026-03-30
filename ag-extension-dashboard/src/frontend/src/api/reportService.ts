import apiClient from './client';

export interface Report {
    id: string;
    type: string;
    title: string;
    generatedAt: string;
    status: string;
    content?: string;
    createdBy?: string;
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

export const deleteReport = async (reportId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/reporting/${reportId}`);
    return response.data;
};
