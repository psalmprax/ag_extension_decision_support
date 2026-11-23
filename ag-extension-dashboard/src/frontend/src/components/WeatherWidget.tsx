import { hasAuthSession } from '@/hooks/useAppAuth';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cloud, CloudRain, Sun, MapPin } from 'lucide-react';
import { fetchWeather } from '@/api/weatherService';
import { useUnits } from '@/hooks/useUnits';

interface WeatherWidgetProps {
  location?: string;
}

interface WeatherData {
  temp: number;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ location = '' }) => {
  const units = useUnits();
  const { data: weatherResponse, isLoading } = useQuery<{ success: boolean; data: WeatherData }>({
    queryKey: ['weather', location],
    queryFn: () => fetchWeather(location),
    refetchInterval: 1000 * 60 * 30, // 30 mins
    // "Global" (a system administrator) is not a place with weather.
    enabled: hasAuthSession() && Boolean(location) && location.toLowerCase() !== 'global',
    // A 503 means the forecast is unavailable for now; the chip simply stays hidden.
    retry: 1,
  });

  // A header chip has no room for a skeleton: show it once there is a reading.
  if (isLoading) return null;

  const weather = weatherResponse?.data;
  if (!weather || !weather.condition) return null;

  const cond = String(weather.condition).toLowerCase();

  const Icon = cond.includes('sun') || cond.includes('clear') ? Sun : cond.includes('rain') || cond.includes('drizzle') ? CloudRain : Cloud;

  return (
    <div
      className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] text-sm text-slate-700 dark:text-theme-text-primary select-none"
      title={weather.condition}
    >
      <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
      <span>{location}</span>
      <span className="w-px h-4 bg-slate-900/[0.08] dark:bg-white/[0.1]" aria-hidden="true" />
      <Icon className="w-4 h-4 text-slate-500 dark:text-theme-text-muted" aria-hidden="true" />
      <span className="font-mono tabular-nums">{units.temp(weather.temperature ?? weather.temp)}</span>
    </div>
  );
};
