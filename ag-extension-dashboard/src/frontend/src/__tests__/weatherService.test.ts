import { describe, it, expect } from 'vitest';

import * as weatherService from '@/api/weatherService';

describe('weatherService', () => {
    it('should export fetchWeather', () => {
        expect(typeof weatherService.fetchWeather).toBe('function');
    });
});
