import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client before importing the service
vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import apiClient from '@/api/client';
import {
  searchKnowledge,
  askAI,
  fetchKnowledgeHistory,
  fetchKnowledgeStats,
  fetchKnowledgeQuota,
} from '@/api/knowledgeService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('knowledgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchKnowledge', () => {
    it('should search with query parameter', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            articles: [{ id: '1', title: 'Maize Disease', content: 'Test content', score: 0.9 }],
            total: 1,
          },
        },
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await searchKnowledge('maize disease');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('q=maize+disease'));
      expect(result.data.articles).toHaveLength(1);
      expect(result.data.articles[0].title).toBe('Maize Disease');
    });

    it('should search with category and crop filters', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: { articles: [], total: 0 } } });

      await searchKnowledge('pest', 'Crop Management', 'maize');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('category=Crop+Management'));
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('crop=maize'));
    });

    it('should handle search errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(searchKnowledge('test')).rejects.toThrow('Network error');
    });
  });

  describe('askAI', () => {
    it('should send question to ask endpoint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            answer: 'To control fall armyworm...',
            contextUsed: [{ content: 'Context snippet', score: 0.8 }],
            cached: false,
          },
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await askAI('How do I control fall armyworm?');

      expect(mockPost).toHaveBeenCalledWith('/knowledge/ask', {
        question: 'How do I control fall armyworm?',
        attachments: undefined,
      });
      expect(result.data.answer).toContain('fall armyworm');
    });

    it('should send question with attachments', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: { answer: 'Answer' } } });

      const attachments = [{ type: 'image' as const, data: 'base64data', name: 'leaf.jpg' }];
      await askAI('What disease is this?', attachments);

      expect(mockPost).toHaveBeenCalledWith('/knowledge/ask', {
        question: 'What disease is this?',
        attachments,
      });
    });
  });

  describe('fetchKnowledgeHistory', () => {
    it('should fetch search history', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', queryText: 'maize disease', createdAt: '2026-05-30T10:00:00Z' },
            { id: '2', queryText: 'pest control', createdAt: '2026-05-30T09:00:00Z' },
          ],
        },
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchKnowledgeHistory();

      expect(mockGet).toHaveBeenCalledWith('/knowledge/history');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('fetchKnowledgeStats', () => {
    it('should fetch search statistics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            crops: [{ name: 'maize', count: 10 }],
            categories: [{ name: 'Crop Management', count: 5 }],
            totalQueries: '15',
            cachedQueries: '3',
          },
        },
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchKnowledgeStats();

      expect(mockGet).toHaveBeenCalledWith('/knowledge/stats');
      expect(result.data.totalQueries).toBe('15');
    });
  });

  describe('fetchKnowledgeQuota', () => {
    it('should fetch knowledge daily quota', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            allowed: true,
            current: 1,
            limit: 3,
            remaining: 2,
            isFree: true,
          },
        },
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchKnowledgeQuota();

      expect(mockGet).toHaveBeenCalledWith('/knowledge/quota');
      expect(result.data.remaining).toBe(2);
      expect(result.data.limit).toBe(3);
      expect(result.data.isFree).toBe(true);
    });
  });
});
