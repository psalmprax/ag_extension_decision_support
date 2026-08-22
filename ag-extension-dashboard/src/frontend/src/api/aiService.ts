import apiClient from './client';

export interface BoxUpdateData {
  summary: string;
  keyObservations: string[];
  recommendedActions: string[];
  cropHealthStatus: 'good' | 'fair' | 'poor' | 'diseased';
  pestIssues: string;
  followUpRequired: boolean;
  nextVisitDateHint: string;
}

export interface SynthesisResponse {
  success: boolean;
  data: BoxUpdateData;
}

export interface TranscribeAudioResponse {
  success: boolean;
  data: {
    text: string;
    language: string;
  };
}

export const synthesizeVisit = async (
  notes: string,
  farmerId?: string
): Promise<SynthesisResponse> => {
  const response = await apiClient.post<SynthesisResponse>('/ai/synthesize-visit', {
    notes,
    farmerId,
  });
  return response.data;
};

export const transcribeAudio = async (
  base64Audio: string,
  language?: string
): Promise<TranscribeAudioResponse> => {
  const response = await apiClient.post<TranscribeAudioResponse>('/ai/transcribe-audio', {
    audio: base64Audio,
    language,
  });
  return response.data;
};

export interface ImageAnalysisResponse {
  success: boolean;
  data: {
    analysis: string;
    model?: string;
  };
}

export interface ChatCompletionResponse {
  success: boolean;
  data: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
}

export const analyzeImage = async (
  image: string,
  prompt?: string
): Promise<ImageAnalysisResponse> => {
  const response = await apiClient.post<ImageAnalysisResponse>('/ai/analyze-image', {
    image,
    prompt,
  });
  return response.data;
};

export const getChatCompletion = async (
  message: string,
  conversationId?: string,
  language?: string
): Promise<ChatCompletionResponse> => {
  const response = await apiClient.post<ChatCompletionResponse>('/chatbot/completions', {
    message,
    conversation_id: conversationId,
    language,
  });
  return response.data;
};
