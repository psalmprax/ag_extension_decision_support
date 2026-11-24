import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRecentWeather } from '@/api/agriDataService';
import { useAppStore } from '@/store/useAppStore';
import { RecentWeather } from '@/components/weather/RecentWeather';

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The signed-in user's own position, or null. No default place: another area's figures would be wrong here. */
function getCoordinates(user: unknown): { lat: number; lng: number } | null {
  const coordinates = user as { latitude?: unknown; longitude?: unknown } | null;
  return isCoordinate(coordinates?.latitude) && isCoordinate(coordinates?.longitude)
    ? { lat: coordinates.latitude, lng: coordinates.longitude }
    : null;
}

/** Rain and temperature NASA POWER measured in the user's own area over the last two weeks. */
export const RecentWeatherCard: React.FC<{ cardClass: string }> = ({ cardClass }) => {
  const user = useAppStore(s => s.user);
  const coordinates = getCoordinates(user);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recent-weather', coordinates?.lat, coordinates?.lng],
    queryFn: () => fetchRecentWeather(coordinates!.lat, coordinates!.lng, 14),
    enabled: Boolean(user && coordinates),
    staleTime: 6 * 60 * 60 * 1000,
  });

  return (
    <div className={`${cardClass} p-4 sm:p-6`}>
      <RecentWeather data={data} loading={isLoading} isError={isError} hasLocation={Boolean(coordinates)} scope="area" />
    </div>
  );
};
