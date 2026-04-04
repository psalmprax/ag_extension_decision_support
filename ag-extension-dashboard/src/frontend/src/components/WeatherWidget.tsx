import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cloud, CloudRain, Sun, Wind, MapPin, Droplets } from 'lucide-react';
import { fetchWeather } from '@/api/weatherService';
import { useLanguage } from '@/lib/LanguageContext';

interface WeatherWidgetProps {
    location?: string;
}

interface WeatherData {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ location = 'Kenya' }) => {
    const { t } = useLanguage();
    const { data: weatherResponse, isLoading } = useQuery<{ success: boolean; data: WeatherData }>({
        queryKey: ['weather', location],
        queryFn: () => fetchWeather(location),
        refetchInterval: 1000 * 60 * 30, // 30 mins
    });

    if (isLoading) {
        return (
            <div className="flex items-center px-4 py-2 bg-white/30 dark:bg-gray-800/20 backdrop-blur-3xl rounded-full border border-white/10">
                <div className="w-1.5 h-1.5 bg-primary-500/50 rounded-full animate-pulse mr-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-16 animate-pulse" />
            </div>
        );
    }

    const weather = weatherResponse?.data;
    if (!weather) return null;

    const cond = weather.condition.toLowerCase();

    let WeatherIconComponent;
    if (cond.includes('sun') || cond.includes('clear')) {
        WeatherIconComponent = <Sun className="text-yellow-500 w-4 h-4 transition-all group-hover:rotate-45" />;
    } else if (cond.includes('rain') || cond.includes('drizzle')) {
        WeatherIconComponent = <CloudRain className="text-blue-500 w-4 h-4 transition-all group-hover:-translate-y-0.5" />;
    } else {
        WeatherIconComponent = <Cloud className="text-blue-400 w-4 h-4 transition-all group-hover:scale-110" />;
    }

    return (
        <div className="flex items-center bg-white/40 dark:bg-black/10 backdrop-blur-3xl px-4 py-2 rounded-full border border-white/20 dark:border-white/5 shadow-lg group select-none transition-all hover:bg-white/60 dark:hover:bg-white/5">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-100 dark:border-white/10">
                <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-primary-500" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">{location}</span>
            </div>

            <div className="flex items-center gap-2 pl-3">
                {WeatherIconComponent}
                <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-gray-900 dark:text-white tracking-tighter">
                        {Math.round(weather.temperature ?? weather.temp ?? 0)}°
                    </span>
                    <span className="text-[10px] font-black text-primary-500/60 uppercase">C</span>
                </div>
            </div>
        </div>
    );
};
