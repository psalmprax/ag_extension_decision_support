import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { success: true, data: { visits: [], total: 0 } } }),
        post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
}));

import apiClient from '@/api/client';
import { fetchVisits, createVisit } from '@/api/visitService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('visitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchVisits', () => {
        it('should call GET /visits', async () => {
            await fetchVisits();

            expect(mockGet).toHaveBeenCalledWith('/visits');
        });

        it('should return visits data', async () => {
            const mockVisits = [
                { id: '1', farmer_name: 'John', status: 'pending' },
                { id: '2', farmer_name: 'Jane', status: 'completed' },
            ];
            mockGet.mockResolvedValueOnce({
                data: { success: true, data: { visits: mockVisits, total: 2 } },
            });

            const result = await fetchVisits();

            expect(result.data.visits).toHaveLength(2);
            expect(result.data.visits[0].farmer_name).toBe('John');
        });
    });

    describe('createVisit', () => {
        it('should call POST /visits with visit data', async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: '3', farmer_id: 'f1', status: 'pending' } },
            });

            await createVisit({ farmer_id: 'f1', scheduled_at: '2026-06-01' });

            expect(mockPost).toHaveBeenCalledWith('/visits', expect.objectContaining({
                farmer_id: 'f1',
            }));
        });

        it('should return created visit', async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: '3', farmer_id: 'f1', status: 'pending' } },
            });

            const result = await createVisit({ farmer_id: 'f1' });

            expect(result.data.id).toBe('3');
        });
    });
});
