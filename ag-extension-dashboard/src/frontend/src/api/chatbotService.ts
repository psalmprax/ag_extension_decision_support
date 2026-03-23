import apiClient from './client';

export const fetchConversations = async () => {
    const { data } = await apiClient.get('/chatbot/conversations');
    return data;
};

export const fetchMessages = async (conversationId: string) => {
    const { data } = await apiClient.get(`/chatbot/conversations/${conversationId}/messages`);
    return data;
};

export const sendMessage = async (params: { conversationId?: string; message: string; farmerId?: string; mode?: string; language?: string }) => {
    const { data } = await apiClient.post('/chatbot/message', params);
    return data;
};

export const createConversation = async (params: { farmerId?: string; farmerName?: string; language?: string }) => {
    const { data } = await apiClient.post('/chatbot/conversations', params);
    return data;
};

// Create AI-only conversation (no farmer required)
export const createAIConversation = async (params: { language?: string }) => {
    const { data } = await apiClient.post('/chatbot/conversations/ai', params);
    return data;
};

export const generateSynthesis = async (params: { farmerId: string; notes: string; visitDate?: string }) => {
    const { data } = await apiClient.post('/chatbot/synthesis', params);
    return data;
};
