import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  fetchVisitsByFarmer,
  fetchSynthesis,
  fetchPriorityScore,
  type PriorityData,
  fetchSatelliteTelemetry,
  type SatelliteIndex,
} from '@/api/visitService';
import { fetchFarmerById, type Farmer } from '@/api/farmerService';

interface LoadedSatelliteData {
  synthesis: string;
  farmer: Farmer;
  priority: PriorityData | null;
  satelliteData: SatelliteIndex[];
}

/** The synthesis endpoint refuses notes shorter than this (400). */
const MIN_SYNTHESIS_NOTES = 10;
const SYNTHESIS_UNAVAILABLE = 'Visit synthesis is unavailable.';

/**
 * A summary of the farmer's last visits. Only the summary depends on this call: when the
 * backend withholds it (422, the agronomic safety review blocked it) or fails, the panel
 * still shows the farmer, priority and satellite data.
 */
export async function loadSynthesis(farmerId: string, visits: Array<{ visit_type: string; notes?: string }>): Promise<string> {
  if (visits.length === 0) return 'No recent visit data available.';
  const notes = visits
    .slice(0, 3)
    .filter(visit => visit.notes?.trim())
    .map(visit => `${visit.visit_type}: ${visit.notes?.trim()}`)
    .join('\n');
  if (notes.length < MIN_SYNTHESIS_NOTES) return 'No visit notes to summarise yet.';
  try {
    const response = await fetchSynthesis(farmerId, notes);
    return response.success ? response.data.summary : SYNTHESIS_UNAVAILABLE;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 422) {
      return 'The visit summary was withheld: it did not pass the agronomic safety review.';
    }
    console.warn('Visit synthesis unavailable:', error);
    return SYNTHESIS_UNAVAILABLE;
  }
}

async function loadSatelliteData(farmerId: string): Promise<LoadedSatelliteData> {
  const farmerResponse = await fetchFarmerById(farmerId);
  if (!farmerResponse.success) throw new Error('Farmer profile unavailable');

  const farmer = farmerResponse.data;
  const [visitsResponse, priorityResponse, satelliteResponse] = await Promise.all([
    fetchVisitsByFarmer(farmerId),
    fetchPriorityScore(farmerId),
    farmer.locationLat && farmer.locationLng
      ? fetchSatelliteTelemetry(Number(farmer.locationLat), Number(farmer.locationLng), farmerId)
      : Promise.resolve({ success: true, data: [] as SatelliteIndex[] }),
  ]);

  return {
    farmer,
    priority: priorityResponse.success ? priorityResponse.data : null,
    satelliteData: satelliteResponse.success ? satelliteResponse.data : [],
    synthesis: await loadSynthesis(farmerId, visitsResponse.data.visits),
  };
}

/** A farmer's profile, priority, satellite indices and a synthesis of recent visits. */
export const useSatelliteData = (farmerId: string) => {
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [priority, setPriority] = useState<PriorityData | null>(null);
  const [satelliteData, setSatelliteData] = useState<SatelliteIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmerId) return;
    let cancelled = false;
    setIsLoading(true);

    loadSatelliteData(farmerId)
      .then(data => {
        if (cancelled) return;
        setDataError(null);
        setFarmer(data.farmer);
        setPriority(data.priority);
        setSatelliteData(data.satelliteData);
        setSynthesis(data.synthesis);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Failed to load real insights:', error);
        setDataError('Live intelligence data is unavailable. Refresh to retry.');
        setFarmer(null);
        setPriority(null);
        setSatelliteData([]);
        setSynthesis(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmerId]);

  return { synthesis, farmer, priority, satelliteData, isLoading, dataError };
};
