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
            <div className="flex items-center space-x-3 bg-white/40 dark:bg-gray-800/40 backdrop-blur-2xl px-6 py-3 rounded-2xl border border-white/20">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-24 animate-pulse" />
            </div>
        );
    }

    const weather = weatherResponse?.data;
    if (!weather) return null;

    const cond = weather.condition.toLowerCase();

    let WeatherIconComponent;
    if (cond.includes('sun') || cond.includes('clear')) {
        WeatherIconComponent = <Sun className="text-yellow-500 w-6 h-6 transition-all group-hover:rotate-45 group-hover:scale-110 duration-700" />;
    } else if (cond.includes('rain') || cond.includes('drizzle')) {
        WeatherIconComponent = <CloudRain className="text-blue-500 w-6 h-6 transition-all group-hover:-translate-y-1 group-hover:scale-110 duration-700" />;
    } else if (cond.includes('cloud')) {
        WeatherIconComponent = <Cloud className="text-blue-400 w-6 h-6 transition-all group-hover:scale-110 duration-700" />;
    } else {
        WeatherIconComponent = <Wind className="text-emerald-500 w-6 h-6 transition-all group-hover:translate-x-1 group-hover:scale-110 duration-700" />;
    }

    return (
        <div className="flex items-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-3xl px-6 py-3 rounded-[40px] border border-white/30 dark:border-white/10 shadow-2xl transition-all hover:shadow-primary-500/10 group select-none">
            {/* Location Section */}
            <div className="flex items-center gap-3 border-r border-gray-100 dark:border-white/10 pr-6 mr-1">
                <div className="relative">
                    <MapPin className="w-4 h-4 text-primary-500 transition-transform group-hover:scale-110 duration-500" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1">Live Location</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{location}</span>
                </div>
            </div>

            {/* Core Temp Section */}
            <div className="flex items-center gap-4 px-6 border-r border-gray-100 dark:border-white/10">
                <div className="p-2 bg-white/50 dark:bg-white/5 rounded-xl transition-all group-hover:bg-primary-500/10">
                    {WeatherIconComponent}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1 leading-none">
                        <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter" style={{ fontFamily: 'var(--font-heading)' }}>
                            {Math.round(weather.temp)}°
                        </span>
                        <span className="text-xs font-black text-primary-500 uppercase">C</span>
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                        {weather.condition}
                    </span>
                </div>
            </div>

            {/* Environment Stats */}
            <div className="flex items-center gap-6 pl-6">
                <div className="flex flex-col items-center group/hum" title={t('weather_humidity')}>
                    <Droplets className="w-4 h-4 text-blue-400 mb-1.5 transition-all group-hover/hum:scale-125 group-hover/hum:-translate-y-0.5 duration-500" />
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-gray-900 dark:text-white tracking-tighter">{weather.humidity}%</span>
                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Hum</span>
                    </div>
                </div>
                <div className="flex flex-col items-center group/wind" title={t('weather_wind')}>
                    <Wind className="w-4 h-4 text-teal-400 mb-1.5 transition-all group-hover/wind:scale-125 group-hover/wind:translate-x-0.5 duration-500" />
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-gray-900 dark:text-white tracking-tighter">{Math.round(weather.windSpeed)}</span>
                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">km/h</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
