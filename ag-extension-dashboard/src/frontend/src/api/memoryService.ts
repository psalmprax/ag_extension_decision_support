import apiClient from './client';

export interface MemoryEntry {
    id: string;
    category: string;
    key: string;
    value: string;
    importance: number;
    createdAt: string;
    lastAccessedAt: string;
    accessCount: number;
}

export const fetchMemories = async (category?: string, limit = 50): Promise<{ success: boolean; data: MemoryEntry[] }> => {
    const url = category ? `/ai/memories?category=${category}&limit=${limit}` : `/ai/memories?limit=${limit}`;
    const response = await apiClient.get(url);
    return response.data;
};

export const storeMemory = async (category: string, key: string, value: string, importance = 0.5): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/ai/memories', { category, key, value, importance });
    return response.data;
};

export const deleteMemory = async (category: string, key: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/ai/memories/${encodeURIComponent(category)}/${encodeURIComponent(key)}`);
    return response.data;
};

export const fetchMemorySummary = async (): Promise<{ success: boolean; data: Array<{ category: string; count: number; avgImportance: number }> }> => {
    const response = await apiClient.get('/ai/memories/summary');
    return response.data;
};
