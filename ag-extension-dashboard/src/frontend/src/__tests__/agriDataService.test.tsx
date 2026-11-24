import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import apiClient from '@/api/client';
import { fetchRecentWeather } from '@/api/agriDataService';
import { RecentWeather } from '@/components/weather/RecentWeather';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn() },
}));

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedGet.mockReset();
});

const payload = (data: unknown[]) => ({
  data: { success: true, data: { data, source: 'nasa-power', dataStatus: 'live', reason: 'r' } },
});

describe('recent weather', () => {
  it('asks for measured rain and temperature, and drops days without both', async () => {
    mockedGet.mockResolvedValueOnce(payload([
      { date: '2026-11-20', rainMm: 3.2, tempC: 21.5 },
      { date: '2026-11-21', rainMm: Number.NaN, tempC: 20 },
    ]));
    const res = await fetchRecentWeather(-1.28, 36.81, 14);
    expect(mockedGet).toHaveBeenCalledWith('/external/recent-weather', { params: { lat: -1.28, lng: 36.81, days: 14 } });
    expect(res.data).toEqual([{ date: '2026-11-20', rainMm: 3.2, tempC: 21.5 }]);
  });

  it('shows the rain total and temperature range, never a vegetation score', () => {
    render(
      <RecentWeather
        data={{ data: [{ date: '2026-11-20', rainMm: 3.2, tempC: 19.5 }, { date: '2026-11-21', rainMm: 10, tempC: 23 }], source: 'nasa-power', dataStatus: 'live', reason: 'r' }}
        loading={false}
        isError={false}
        hasLocation
        scope="farm"
      />,
    );
    expect(screen.getByText('Rain and temperature')).toBeInTheDocument();
    expect(screen.getByText(/13\.2 mm of rain; daily mean temperature 19\.5 to 23 °C/)).toBeInTheDocument();
    expect(screen.queryByText(/Healthy|Lush|Stressed|vegetation/i)).toBeNull();
  });
});
