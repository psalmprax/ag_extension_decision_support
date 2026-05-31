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

export interface AskResponse {
    success: boolean;
    data: {
        answer: string;
        contextUsed: ContextItem[];
        cached?: boolean;
        visuals?: {
            kpis?: KnowledgeKPI[];
            charts?: KnowledgeChart[];
            images?: Array<{ url: string; caption?: string }>;
            videos?: Array<{ url: string; caption?: string }>;
        };
    };
}

export const searchKnowledge = async (query: string, category?: string, crop?: string): Promise<SearchResponse> => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    if (crop) params.append('crop', crop);

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
        attachments
    });
    return response.data;
};

export const fetchKnowledgeHistory = async () => {
    const { data } = await apiClient.get('/knowledge/history');
    return data;
};

export const fetchKnowledgeStats = async () => {
    const { data } = await apiClient.get('/knowledge/stats');
    return data;
};
