/** Weather and market lines for USSD screens: short, and honest about estimates. */
import { logger } from '@/utils/logger';
import { WeatherService } from '@/services/weatherService';
import { marketPriceService } from '@/services/marketPriceService';
import { smsLanguage, type SmsLanguage } from './smsCopy';

const WORDS: Record<SmsLanguage, Record<'register' | 'rain' | 'humidity' | 'noWeather' | 'noPrices' | 'estimates', string>> = {
    en: { register: 'Register to get the weather for your area.', rain: 'rain', humidity: 'humidity', noWeather: 'Weather is not available right now.', noPrices: 'Market prices are not available right now.', estimates: '(estimates)' },
    sw: { register: 'Jisajili ili upate hali ya hewa ya eneo lako.', rain: 'mvua', humidity: 'unyevu', noWeather: 'Hali ya hewa haipatikani sasa.', noPrices: 'Bei za soko hazipatikani sasa.', estimates: '(makadirio)' },
    fr: { register: 'Inscrivez-vous pour avoir la météo de votre zone.', rain: 'pluie', humidity: 'humidité', noWeather: 'La météo n’est pas disponible pour le moment.', noPrices: 'Les prix du marché ne sont pas disponibles pour le moment.', estimates: '(estimations)' },
    pt: { register: 'Registe-se para receber o tempo da sua zona.', rain: 'chuva', humidity: 'humidade', noWeather: 'O tempo não está disponível agora.', noPrices: 'Os preços do mercado não estão disponíveis agora.', estimates: '(estimativas)' },
};

export async function weatherLine(place: string | null, language: string | null | undefined): Promise<string> {
    const w = WORDS[smsLanguage(language)];
    if (!place) return w.register;
    try {
        const weather = await WeatherService.getByLocation(place);
        const rain = weather.precipitationMm !== undefined ? `, ${w.rain} ${weather.precipitationMm} mm` : '';
        return `${place}: ${weather.condition}, ${Math.round(weather.temp)} C, ${w.humidity} ${weather.humidity}%${rain}`;
    } catch (error) {
        logger.warn('USSD weather lookup failed:', error);
        return w.noWeather;
    }
}

export async function marketLines(country: string | null, language: string | null | undefined): Promise<string> {
    const w = WORDS[smsLanguage(language)];
    try {
        const prices = await marketPriceService.getLatestPrices(undefined, country ?? undefined);
        const shown = prices.filter(p => p.dataStatus !== 'unavailable').slice(0, 4);
        if (shown.length === 0) return w.noPrices;
        const estimated = shown.some(p => p.dataStatus === 'estimated');
        return `${shown.map(p => `${p.crop}: ${p.price}`).join('\n')}${estimated ? `\n${w.estimates}` : ''}`;
    } catch (error) {
        logger.warn('USSD market lookup failed:', error);
        return w.noPrices;
    }
}
