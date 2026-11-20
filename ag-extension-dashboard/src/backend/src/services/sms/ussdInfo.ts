/** Weather and market lines for USSD screens: short, and honest about estimates. */
import { logger } from '@/utils/logger';
import { WeatherService } from '@/services/weatherService';
import { marketPriceService } from '@/services/marketPriceService';
import { smsLanguage } from './smsCopy';

export async function weatherLine(place: string | null, language: string | null | undefined): Promise<string> {
    const sw = smsLanguage(language) === 'sw';
    if (!place) return sw ? 'Jisajili ili upate hali ya hewa ya eneo lako.' : 'Register to get the weather for your area.';
    try {
        const weather = await WeatherService.getByLocation(place);
        const rain = weather.precipitationMm !== undefined ? `, ${sw ? 'mvua' : 'rain'} ${weather.precipitationMm} mm` : '';
        return `${place}: ${weather.condition}, ${Math.round(weather.temp)} C, ${sw ? 'unyevu' : 'humidity'} ${weather.humidity}%${rain}`;
    } catch (error) {
        logger.warn('USSD weather lookup failed:', error);
        return sw ? 'Hali ya hewa haipatikani sasa.' : 'Weather is not available right now.';
    }
}

export async function marketLines(country: string | null, language: string | null | undefined): Promise<string> {
    const sw = smsLanguage(language) === 'sw';
    try {
        const prices = await marketPriceService.getLatestPrices(undefined, country ?? undefined);
        const shown = prices.filter(p => p.dataStatus !== 'unavailable').slice(0, 4);
        if (shown.length === 0) return sw ? 'Bei za soko hazipatikani sasa.' : 'Market prices are not available right now.';
        const estimated = shown.some(p => p.dataStatus === 'estimated');
        const note = estimated ? (sw ? '\n(makadirio)' : '\n(estimates)') : '';
        return `${shown.map(p => `${p.crop}: ${p.price}`).join('\n')}${note}`;
    } catch (error) {
        logger.warn('USSD market lookup failed:', error);
        return sw ? 'Bei za soko hazipatikani sasa.' : 'Market prices are not available right now.';
    }
}
