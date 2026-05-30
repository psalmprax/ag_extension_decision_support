import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { success: true, data: { farmers: [], total: 0 } } }),
        post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
}));

import apiClient from '@/api/client';
import { fetchFarmers, createFarmer } from '@/api/farmerService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('farmerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchFarmers', () => {
        it('should call GET /farmers', async () => {
            await fetchFarmers();

            expect(mockGet).toHaveBeenCalledWith('/farmers');
        });

        it('should return farmers data', async () => {
            const mockFarmers = [
                { id: '1', firstName: 'John', lastName: 'Doe' },
                { id: '2', firstName: 'Jane', lastName: 'Smith' },
            ];
            mockGet.mockResolvedValueOnce({
                data: { success: true, data: { farmers: mockFarmers, total: 2 } },
            });

            const result = await fetchFarmers();

            expect(result.data.farmers).toHaveLength(2);
            expect(result.data.farmers[0].firstName).toBe('John');
        });
    });

    describe('createFarmer', () => {
        it('should call POST /farmers with farmer data', async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: '3', firstName: 'New' } },
            });

            await createFarmer({ firstName: 'New', lastName: 'Farmer' });

            expect(mockPost).toHaveBeenCalledWith('/farmers', expect.objectContaining({
                firstName: 'New',
            }));
        });

        it('should return created farmer', async () => {
            mockPost.mockResolvedValueOnce({
                data: { success: true, data: { id: '3', firstName: 'New', lastName: 'Farmer' } },
            });

            const result = await createFarmer({ firstName: 'New' });

            expect(result.data.id).toBe('3');
        });
    });
});
