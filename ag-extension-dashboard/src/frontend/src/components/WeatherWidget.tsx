import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cloud, CloudRain, Sun, Wind, Thermometer, MapPin, Droplets } from 'lucide-react';
import { fetchWeather } from '@/api/weatherService';
import { Skeleton } from './Skeleton';
import { useLanguage } from '@/lib/LanguageContext';

interface WeatherWidgetProps {
    location?: string;
}

// ... imports ...

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ location = 'Kenya' }) => {
    const { t } = useLanguage();
    const { data: weatherResponse, isLoading } = useQuery({
        queryKey: ['weather', location],
        queryFn: () => fetchWeather(location),
        refetchInterval: 1000 * 60 * 30, // 30 mins
    });

    if (isLoading) {
        return (
            <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                <div className="w-6 h-6 bg-white/10 rounded-full animate-pulse" />
                <div className="h-4 bg-white/10 rounded-full w-20 animate-pulse" />
            </div>
        );
    }

    const weather = weatherResponse?.data;
    if (!weather) return null;

    const WeatherIcon = () => {
        const cond = weather.condition.toLowerCase();
        if (cond.includes('sun') || cond.includes('clear')) return <Sun className="text-yellow-500 w-5 h-5 transition-transform hover:rotate-12 duration-500" />;
        if (cond.includes('rain') || cond.includes('drizzle')) return <CloudRain className="text-blue-500 w-5 h-5 transition-transform hover:-translate-y-0.5 duration-500" />;
        if (cond.includes('cloud')) return <Cloud className="text-gray-400 w-5 h-5 transition-transform hover:scale-105 duration-500" />;
        return <Wind className="text-teal-500 w-5 h-5 transition-transform hover:scale-105 duration-500" />;
    };

    return (
        <div className="flex items-center space-x-4 bg-white/50 dark:bg-gray-900/40 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl transition-all hover:shadow-primary-500/5 group">
            <div className="flex items-center space-x-2 border-r border-gray-100 dark:border-white/5 pr-4 mr-1">
                <MapPin className="w-3.5 h-3.5 text-primary-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{location}</span>
            </div>

            <div className="flex items-center space-x-3">
                <WeatherIcon />
                <div className="flex flex-col">
                    <div className="flex items-baseline space-x-1 leading-none mb-0.5">
                        <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{Math.round(weather.temp)}°</span>
                        <span className="text-[10px] font-black text-gray-400/60 uppercase tracking-widest">{t('weather_celsius')}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-400/80 uppercase tracking-widest truncate max-w-[80px] leading-tight">
                        {weather.condition}
                    </span>
                </div>
            </div>

            <div className="flex items-center space-x-4 border-l border-gray-100 dark:border-white/5 pl-4">
                <div className="flex flex-col items-center group/hum" title={t('weather_humidity')}>
                    <Droplets className="w-3.5 h-3.5 text-blue-400 mb-1 transition-transform group-hover/hum:scale-110 duration-500" />
                    <span className="text-[10px] font-black text-gray-400/80 uppercase tracking-tighter">{weather.humidity}%</span>
                </div>
                <div className="flex flex-col items-center group/wind" title={t('weather_wind')}>
                    <Wind className="w-3.5 h-3.5 text-teal-400 mb-1 transition-transform group-hover/wind:scale-110 duration-500" />
                    <span className="text-[10px] font-black text-gray-400/80 uppercase tracking-tighter">{Math.round(weather.windSpeed)}<span className="text-[8px] opacity-60">KPH</span></span>
                </div>
            </div>
        </div>
    );
};
