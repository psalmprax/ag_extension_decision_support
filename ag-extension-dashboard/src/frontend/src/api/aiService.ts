import apiClient from './client';
import type { AnswerSource } from '@/types/dashboard';

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
  error?: string;
}

export interface TranscribeAudioResponse {
  success: boolean;
  data: {
    text: string;
    language: string;
    /** False when the transcriber does not know the language and guessed it, so the text needs checking. */
    languageSupported?: boolean;
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

/** A visit report drafted from what the officer said, built only from their own sentences. */
export interface VisitReportDraft {
  findings: string;
  actions: string;
  minutesOnFarm: number | null;
  followUpRequired: boolean | null;
  followUpInDays: number | null;
  /** False when the sentences could not be sorted and are all under findings. */
  organised: boolean;
}

export const draftVisitReport = async (transcript: string): Promise<VisitReportDraft> => {
  const response = await apiClient.post<{ success: boolean; data: VisitReportDraft }>('/ai/draft-visit-report', { transcript });
  return response.data.data;
};

export interface ImageAnalysisResponse {
  success: boolean;
  data: {
    analysis: string;
    model?: string;
  };
}

/** One retrieved source behind an AI answer (backend AdvisoryCitation). */
export interface AdvisoryCitationDto {
  sourceId: string;
  title: string;
  sourceUrl?: string;
}

export interface ChatCompletionResponse {
  success: boolean;
  data: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    citations?: AdvisoryCitationDto[];
    /** status 'general_guidance_only' = nothing was retrieved; invalidReferences = it cited sources it was not given. */
    advisoryQuality?: { status: string; invalidReferences?: boolean };
  };
}

/** An officer's copilot draft and what it rests on. */
export interface CopilotDraft {
  text: string;
  sources: AnswerSource[];
  evidence: 'sourced' | 'general';
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

/**
 * An officer's private copilot draft for a farmer thread: the AI reads the
 * thread for context, and nothing is stored or shown to the farmer.
 */
export const getCopilotDraft = async (
  conversationId: string,
  instruction: string,
  language?: string
): Promise<CopilotDraft> => {
  const response = await apiClient.post<ChatCompletionResponse>('/chatbot/completions', {
    message: instruction,
    conversation_id: conversationId,
    language,
    mode: 'draft',
  });
  const { messages, citations = [], advisoryQuality } = response.data.data;
  const sourced = advisoryQuality?.status !== 'general_guidance_only' && !advisoryQuality?.invalidReferences && citations.length > 0;
  return {
    text: messages.find(message => message.role === 'assistant')?.content ?? '',
    sources: citations.map((citation, index) => ({ n: index + 1, title: citation.title, url: citation.sourceUrl ?? null })),
    evidence: sourced ? 'sourced' : 'general',
  };
};

export const getPublicDemoChatCompletion = async (
  message: string,
  language = 'en'
): Promise<{ success: boolean; data: { text: string }; error?: string }> => {
  const response = await apiClient.post<{ success: boolean; data: { text: string }; error?: string }>('/chatbot/public-demo', {
    query: message,
    language,
  });
  return response.data;
};

export interface TextToSpeechResponse {
  success: boolean;
  data?: {
    audioUrl?: string;
    audioBase64?: string;
    format?: string;
  };
  error?: string;
}

export const synthesizeSpeech = async (
  text: string,
  language = 'en',
  voice = 'default'
): Promise<TextToSpeechResponse> => {
  const response = await apiClient.post<TextToSpeechResponse>('/chatbot/speech/text-to-speech', {
    text,
    language,
    voice,
  });
  return response.data;
};
