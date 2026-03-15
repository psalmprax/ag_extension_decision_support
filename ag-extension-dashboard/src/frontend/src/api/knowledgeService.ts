import apiClient from './client';

export interface SearchResponse {
    success: boolean;
    data: {
        articles: any[];
        total: number;
    };
}

export interface AskResponse {
    success: boolean;
    data: {
        answer: string;
        contextUsed: any[];
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
