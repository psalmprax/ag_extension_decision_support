import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

import apiClient from '@/api/client';
import { fetchWeather } from '@/api/weatherService';

const mockGet = vi.mocked(apiClient.get);

describe('weatherService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchWeather', () => {
        it('should fetch weather for a location string', async () => {
            const mockWeather = {
                data: {
                    success: true,
                    data: {
                        temperature: 28,
                        humidity: 65,
                        description: 'Partly cloudy',
                        location: 'Lilongwe',
                    },
                },
            };
            mockGet.mockResolvedValue(mockWeather);

            const result = await fetchWeather('Lilongwe');

            expect(mockGet).toHaveBeenCalledWith('/external/weather', {
                params: { location: 'Lilongwe' },
            });
            expect(result.data.temperature).toBe(28);
        });

        it('should handle weather API errors', async () => {
            mockGet.mockRejectedValue(new Error('Weather service unavailable'));

            await expect(fetchWeather('Unknown')).rejects.toThrow('Weather service unavailable');
        });
    });
});
