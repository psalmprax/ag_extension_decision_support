import apiClient from './client';

export interface SMSMessage {
    id: string;
    sender_id?: string;
    recipient_phone: string;
    farmer_id?: string;
    message: string;
    status: 'sent' | 'failed' | 'delivered';
    provider?: string;
    created_at: string;
}

export interface SMSHistoryResponse {
    success: boolean;
    data: SMSMessage[];
}

export const fetchSMSHistory = async (farmerId?: string): Promise<SMSHistoryResponse> => {
    const response = await apiClient.get<SMSHistoryResponse>('/sms/history', {
        params: { farmerId }
    });
    return response.data;
};

export const sendSMS = async (params: { to: string; message: string; farmerId?: string }) => {
    const response = await apiClient.post('/sms/send', params);
    return response.data;
};

export const sendBulkSMS = async (params: { recipients: string[]; message: string; farmerId?: string }) => {
    const response = await apiClient.post('/sms/bulk', params);
    return response.data;
};

export const translateMessage = async (params: { text: string; targetLanguage: string }) => {
    const response = await apiClient.post('/sms/translate', params);
    return response.data;
};
