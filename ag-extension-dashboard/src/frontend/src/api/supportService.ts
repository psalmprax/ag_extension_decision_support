import apiClient from './client';

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
}

export interface SupportTicket {
    id: string;
    subject: string;
    category: string;
    description?: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
}

export const fetchFAQs = async (): Promise<{ success: boolean; data: FAQ[] }> => {
    const { data } = await apiClient.get('/support/faq');
    return data;
};

export const createSupportTicket = async (params: {
    subject: string;
    category?: string;
    description: string;
}): Promise<{ success: boolean; data: SupportTicket }> => {
    const { data } = await apiClient.post('/support/tickets', params);
    return data;
};
