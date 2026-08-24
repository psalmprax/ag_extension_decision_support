import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, Popup } from 'react-leaflet';
import { Biohazard } from 'lucide-react';
import { outbreakService, OutbreakCluster } from '@/api/efficacyService';

/**
 * Outbreak intelligence layer for FarmerMap — plots k-anonymized disease
 * clusters as scaled circles at their district centroid. Clusters below the
 * backend k-anonymity floor are never returned, so nothing here is identifiable.
 */
export function OutbreakLayer() {
  const [enabled, setEnabled] = useState(false);
  const { data } = useQuery({
    queryKey: ['outbreak-clusters'],
    queryFn: () => outbreakService.getClusters({ days: 14 }),
    enabled,
    refetchInterval: 10 * 60 * 1000,
  });

  const toggle = (
    <button
      onClick={() => setEnabled(e => !e)}
      aria-pressed={enabled}
      className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold rounded-xl transition-all ${
        enabled ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <Biohazard className="w-3.5 h-3.5" />
      Outbreaks
    </button>
  );

  return (
    <>
      {toggle}
      {enabled &&
        (data || [])
          .filter((c: OutbreakCluster) => c.centroid)
          .map(c => (
            <CircleMarker
              key={`${c.district}-${c.diseaseLabel}`}
              center={[c.centroid!.lat, c.centroid!.lng]}
              radius={Math.min(6 + Math.sqrt(c.caseCount) * 3, 24)}
              pathOptions={{
                color: c.alert ? '#ef4444' : '#f59e0b',
                fillColor: c.alert ? '#ef4444' : '#f59e0b',
                fillOpacity: 0.35,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold capitalize">
                    {c.diseaseLabel.replace(/_/g, ' ')} — {c.crop}
                  </p>
                  <p>
                    {c.caseCount} cases · {c.distinctFarmers} farms · {c.district}
                  </p>
                  <p className="text-gray-400">Last 14 days (anonymized, k≥3)</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
    </>
  );
}
