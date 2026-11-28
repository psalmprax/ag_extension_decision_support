import { useEffect, useState } from 'react';
import { fetchFarmers } from '../../api/farmerService';
import { useAppStore } from '@/store/useAppStore';

export interface SoilFarmerOption {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * The farmers whose soil the Soil tab can show. An officer chooses from their portfolio; a
 * farmer's list holds only their own record, so it is chosen for them.
 */
export function useSoilFarmers(onOwnRecord: (farmerId: string) => void /* a stable state setter */) {
  const isFarmer = useAppStore(s => s.user?.role === 'farmer');
  const [farmers, setFarmers] = useState<SoilFarmerOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmers()
      .then(res => {
        const list = res.success && Array.isArray(res.data?.farmers) ? res.data.farmers : Array.isArray(res.data) ? res.data : null;
        if (!list) return;
        setFarmers(list);
        if (isFarmer && list.length === 1) onOwnRecord(list[0].id);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'request failed'));
  }, [isFarmer, onOwnRecord]);

  return { farmers, error };
}
