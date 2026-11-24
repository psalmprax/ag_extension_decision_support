import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, Popup } from 'react-leaflet';
import { Biohazard } from 'lucide-react';
import { outbreakService, OutbreakCluster } from '@/api/efficacyService';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Outbreak layer for FarmerMap: k-anonymized disease clusters from field reports, as scaled
 * circles at their district centroid. Clusters below the backend k-anonymity floor are never
 * returned, so nothing here is identifiable. It shows where reports are, not where a disease
 * will spread: no spread model here has a source.
 */
export function OutbreakLayer() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);

  const { data } = useQuery({
    queryKey: ['outbreak-clusters'],
    queryFn: () => outbreakService.getClusters({ days: 14 }),
    enabled,
    refetchInterval: 10 * 60 * 1000,
  });

  return (
    <>
      <button
        onClick={() => setEnabled(prev => !prev)}
        aria-pressed={enabled}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-xl transition-all ${
          enabled ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        <Biohazard className="w-3.5 h-3.5" />
        {t('ui_outbreak_layer_outbreaks')}
      </button>
      {enabled && (data || [])
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
              <div className="text-xs space-y-1 min-w-[200px]">
                <p className="font-medium capitalize text-slate-100">
                  {c.diseaseLabel.replace(/_/g, ' ')} — {c.crop}
                </p>
                <p className="text-slate-300 text-[11px]">
                  {t('ui_outbreak_layer_cases_farms', { caseCount: c.caseCount, distinctFarmers: c.distinctFarmers, district: c.district })}
                </p>
                <p className="text-gray-400 text-[10px]">
                  {t('ui_outbreak_layer_last_14_days_anonymized_k_3')}{c.differentialPrivacyApplied ? ', ε=1.0 DP' : ''})
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}
