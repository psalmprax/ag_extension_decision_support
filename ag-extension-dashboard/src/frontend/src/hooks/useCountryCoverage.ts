import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { CountryProfile } from '@/lib/countries';

export interface CountryCoverage extends CountryProfile {
  prices: 'local_markets' | 'national_yearly' | 'none';
  smsLanguages: string[];
  mobileMoney: string[];
  supportLevel: 'full' | 'partial' | 'basic';
}

/** What the product can serve in each country, from the server's live integrations. */
export function useCountryCoverage() {
  return useQuery({
    queryKey: ['country-coverage'],
    queryFn: async () => (await apiClient.get<{ success: boolean; data: CountryCoverage[] }>('/countries')).data.data,
    staleTime: 60 * 60 * 1000,
  });
}
