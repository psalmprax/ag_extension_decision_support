import apiClient from './client';

export const fetchConversations = async () => {
  const { data } = await apiClient.get('/chatbot/conversations');
  return data;
};

export const fetchMessages = async (conversationId: string) => {
  const { data } = await apiClient.get(`/chatbot/conversations/${conversationId}/messages`);
  return data;
};

export const sendMessage = async (params: {
  conversationId?: string;
  message: string;
  farmerId?: string;
  mode?: string;
  language?: string;
}) => {
  const { data } = await apiClient.post('/chatbot/message', params);
  return data;
};

export const createConversation = async (params: {
  farmerId?: string;
  farmerName?: string;
  language?: string;
}) => {
  const { data } = await apiClient.post('/chatbot/conversations', params);
  return data;
};

export const generateSynthesis = async (params: {
  farmerId: string;
  notes: string;
  visitDate?: string;
}) => {
  const { data } = await apiClient.post('/chatbot/synthesis', params);
  return data;
};

export const updateConversation = async (id: string, updates: { title?: string }) => {
  const { data } = await apiClient.put(`/chatbot/conversations/${id}`, updates);
  return data;
};

export const deleteConversation = async (id: string) => {
  const { data } = await apiClient.delete(`/chatbot/conversations/${id}`);
  return data;
};
