import apiClient from './client';

export const fetchWeather = async (location: string) => {
    const { data } = await apiClient.get('/external/weather', {
        params: { location }
    });
    return data;
};
