import apiClient from './client';

export const fetchWeather = async (location: string) => {
    const { data } = await apiClient.get('/external/weather', {
        params: { location }
    });
    return data;
};

export const fetchWeatherTyped = async (location: string): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    const { data } = await apiClient.get('/external/weather', {
        params: { location }
    });
    return data;
};
