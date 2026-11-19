import apiClient from './client';

/** farmer_thread: farmer, officer and AI; officer_ai: an officer's private AI chat. */
export type ConversationKind = 'farmer_thread' | 'officer_ai';

export const fetchConversations = async (kind: ConversationKind = 'farmer_thread') => {
  const { data } = await apiClient.get('/chatbot/conversations', { params: { kind } });
  return data;
};

export const fetchMessages = async (conversationId: string) => {
  const { data } = await apiClient.get(`/chatbot/conversations/${conversationId}/messages`);
  return data;
};

export const createConversation = async (params: {
  farmerId?: string;
  farmerName?: string;
  language?: string;
  kind?: ConversationKind;
}) => {
  const { data } = await apiClient.post('/chatbot/conversations', params);
  return data;
};

export const generateSynthesis = async (params: {
  farmerId: string;
  notes: string;
  visitDate?: string;
}) => {
  // Served by the safety-guarded visit-synthesis pipeline (no dedicated
  // /chatbot/synthesis route exists); farmerId is accepted by its schema.
  const { data } = await apiClient.post('/ai/synthesize-visit', {
    notes: params.notes,
    farmerId: params.farmerId,
  });
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

/** A plain message from the signed-in user into a thread. No AI reply is triggered. */
export const sendThreadMessage = async (
  conversationId: string,
  content: string,
  language?: string,
  attachmentIds?: string[]
) => {
  const { data } = await apiClient.post('/chatbot/messages', {
    conversationId,
    content,
    language,
    ...(attachmentIds?.length ? { attachmentIds } : {}),
  });
  return data;
};

/** The farmer asks the AI to answer their latest message now (their officer can see the answer). */
export const askAiInThread = async (conversationId: string) => {
  const { data } = await apiClient.post(`/chatbot/conversations/${conversationId}/ask-ai`);
  return data;
};

/** How long the farmer waits for their officer before the AI answers, and when the officer works. */
export interface TurnTakingSettings {
  aiFallbackMinutes: number;
  workingHours: { start: string; end: string; days: number[]; timezone: string };
  aiPauseAfterOfficerMinutes: number;
  smsAiDailyLimit: number;
}

export const fetchTurnTakingSettings = async (): Promise<{ tenantId: string | null; settings: TurnTakingSettings }> => {
  const { data } = await apiClient.get('/chatbot/turn-taking');
  return data.data;
};

export const saveTurnTakingSettings = async (settings: TurnTakingSettings, tenantId?: string) => {
  const { data } = await apiClient.put('/chatbot/turn-taking', { settings, ...(tenantId ? { tenantId } : {}) });
  return data.data as { tenantId: string; settings: TurnTakingSettings };
};

