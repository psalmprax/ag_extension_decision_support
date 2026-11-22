import apiClient from './client';
import { fetchAllPages } from './fetchAllPages';
import type { Report, ReportListResponse } from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { Report };
export type ReportsResponse = ReportListResponse;

/** Every report this person may see, page by page; one request returned only the latest 20. */
export const fetchReports = (): Promise<ReportListResponse> =>
  fetchAllPages('/reporting', 'reports', { pageSize: 200, ceiling: 2_000 }) as Promise<ReportListResponse>;

export const generateReport = async (
  type: string,
  title?: string,
  farmerId?: string,
  extra?: { content?: string; citations?: string[]; question?: string }
) => {
  const response = await apiClient.post('/reporting/generate', {
    type,
    title,
    farmerId,
    ...(extra || {}),
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
