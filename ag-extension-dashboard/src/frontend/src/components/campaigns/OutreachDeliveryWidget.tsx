import React, { useCallback, useEffect, useState } from 'react';
import { fetchOutreachStats, OutreachDeliveryStats } from '@/api/campaignService';
import { OutreachDeliveryStatusCard } from './OutreachDeliveryStatusCard';

export const OutreachDeliveryWidget: React.FC = () => {
  const [stats, setStats] = useState<OutreachDeliveryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetchOutreachStats();
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setError(true);
      }
    } catch {
      setStats(null);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return <OutreachDeliveryStatusCard stats={stats} isLoading={isLoading} onRefresh={load} error={error} />;
};