import apiClient from './client';
import type { Report, ReportListResponse } from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { Report };
export type ReportsResponse = ReportListResponse;

export const fetchReports = async (): Promise<ReportListResponse> => {
  const response = await apiClient.get<ReportListResponse>('/reporting');
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

export const downloadReportPdf = async (reportId: string): Promise<Blob> => {
  const response = await apiClient.get(`/reporting/${reportId}/download/pdf`, {
    responseType: 'blob',
  });
  return response.data;
};

export const getReportContent = async (
  reportId: string
): Promise<{ success: boolean; data: Report }> => {
  const response = await apiClient.get(`/reporting/${reportId}`);
  return response.data;
};
