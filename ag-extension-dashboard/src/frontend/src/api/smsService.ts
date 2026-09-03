import apiClient from './client';
import type { SMSHistoryRecord } from '../pages/sms/types';

export interface SMSHistoryResponse {
  success: boolean;
  data: SMSHistoryRecord[];
}

export const fetchSMSHistory = async (farmerId?: string): Promise<SMSHistoryResponse> => {
  const response = await apiClient.get<SMSHistoryResponse>('/sms/history', {
    params: { farmerId },
  });
  return response.data;
};

export const sendSMS = async (params: { to: string; message: string; farmerId?: string }) => {
  const response = await apiClient.post('/sms/send', params);
  return response.data;
};

export const sendBulkSMS = async (params: {
  recipients: string[];
  message: string;
  farmerId?: string;
}) => {
  const response = await apiClient.post('/sms/bulk', params);
  return response.data;
};

export const translateMessage = async (params: { text: string; targetLanguage: string }) => {
  const response = await apiClient.post('/sms/translate', params);
  return response.data;
};

export const scheduleSMS = async (params: {
  to: string;
  message: string;
  scheduledTime: string;
  farmerId?: string;
}) => {
  const response = await apiClient.post('/sms/schedule', params);
  return response.data;
};
