import apiClient from './client';

export interface SearchResponse {
    success: boolean;
    data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        articles: any[];
        total: number;
    };
}

export interface AskResponse {
    success: boolean;
    data: {
        answer: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contextUsed: any[];
        cached?: boolean;
        visuals?: {
            kpis?: any[];
            charts?: any[];
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

export const askAI = async (question: string): Promise<AskResponse> => {
    const response = await apiClient.post<AskResponse>('/knowledge/ask', { question });
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
