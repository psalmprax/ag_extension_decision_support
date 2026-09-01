import apiClient from './client';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category?: string;
  crop?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  success: boolean;
  data: {
    articles: KnowledgeArticle[];
    total: number;
  };
}

export interface ContextItem {
  content: string;
  source?: string;
  score?: number;
  metadata?: {
    title?: string;
    sourceUrl?: string;
    crop?: string;
    category?: string;
  };
}

export interface KnowledgeKPI {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  trend?: string;
}

export interface KnowledgeChart {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: Array<{ label: string; value: number }>;
}

export interface Citation {
  sourceId: string;
  title: string;
  category: string;
  excerpt: string;
  score: number;
}

export type KnowledgeEvidenceStatus = 'verified_sources' | 'context_only' | 'no_verified_source';

export interface AskResponse {
  success: boolean;
  data: {
    answer: string;
    contextUsed: ContextItem[];
    cached?: boolean;
    citations?: Citation[];
    evidenceStatus?: KnowledgeEvidenceStatus;
    visuals?: {
      kpis?: KnowledgeKPI[];
      charts?: KnowledgeChart[];
      images?: Array<{ url: string; caption?: string }>;
      videos?: Array<{ url: string; caption?: string }>;
    };
  };
}

export const searchKnowledge = async (
  query: string,
  category?: string,
  crop?: string,
  v2: boolean = true
): Promise<SearchResponse> => {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category) params.append('category', category);
  if (crop) params.append('crop', crop);
  if (v2) params.append('v2', 'true');

  const response = await apiClient.get<SearchResponse>(`/knowledge/search?${params.toString()}`);
  return response.data;
};

export interface Attachment {
  type: 'image' | 'file' | 'audio';
  data: string;
  name?: string;
  mimeType?: string;
}

export const askAI = async (question: string, attachments?: Attachment[]): Promise<AskResponse> => {
  const response = await apiClient.post<AskResponse>('/knowledge/ask', {
    question,
    attachments,
  });
  return response.data;
};

export const downloadKnowledgePack = async (region?: string, limit = 200): Promise<void> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (region) params.set('region', region);
  const response = await apiClient.get(`/knowledge/offline-pack?${params.toString()}`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `knowledge-pack-${region || 'global'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const fetchKnowledgeHistory = async () => {
  const { data } = await apiClient.get('/knowledge/history');
  return data;
};

export const fetchKnowledgeStats = async () => {
  const { data } = await apiClient.get('/knowledge/stats');
  return data;
};

export interface KnowledgeQuotaData {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isFree: boolean;
}

export const fetchKnowledgeQuota = async (): Promise<{ success: boolean; data: KnowledgeQuotaData }> => {
  const { data } = await apiClient.get('/knowledge/quota');
  return data;
};

export interface TranslationResponse {
  translatedText: string;
  targetLanguage: string;
  sourceLanguage?: string;
  cached?: boolean;
}

export const translateContent = async (
  text: string,
  targetLanguage: string,
  sourceLanguage = 'en'
): Promise<{ success: boolean; data: TranslationResponse }> => {
  const { data } = await apiClient.post('/language/translate', {
    text,
    targetLanguage,
    sourceLanguage,
  });
  return data;
};
