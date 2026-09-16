import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, Popup, Polygon } from 'react-leaflet';
import { Biohazard, Wind, Loader2 } from 'lucide-react';
import { outbreakService, OutbreakCluster, AtmosphericDispersalProjection } from '@/api/efficacyService';

interface ActiveProjectionState {
  clusterKey: string;
  projection: AtmosphericDispersalProjection;
}

/**
 * Outbreak intelligence layer for FarmerMap — plots k-anonymized disease
 * clusters as scaled circles at their district centroid. Clusters below the
 * backend k-anonymity floor are never returned, so nothing here is identifiable.
 * Supports interactive Gaussian plume atmospheric spore dispersal modeling (CE-002).
 */
export function OutbreakLayer() {
  const [enabled, setEnabled] = useState(false);
  const [activeProjection, setActiveProjection] = useState<ActiveProjectionState | null>(null);
  const [projectingCluster, setProjectingCluster] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['outbreak-clusters'],
    queryFn: () => outbreakService.getClusters({ days: 14 }),
    enabled,
    refetchInterval: 10 * 60 * 1000,
  });

  const handleTogglePlume = async (c: OutbreakCluster) => {
    if (!c.centroid) return;
    const key = `${c.district}-${c.diseaseLabel}`;
    if (activeProjection?.clusterKey === key) {
      setActiveProjection(null);
      return;
    }
    setProjectingCluster(key);
    try {
      const projection = await outbreakService.getDispersalProjection({
        centroid: c.centroid,
        crop: c.crop,
        diseaseLabel: c.diseaseLabel,
        windSpeedKmH: 18,
        windBearingDeg: 45,
        relativeHumidity: 80,
        temperatureC: 24,
        timeHorizonHours: 24,
      });
      setActiveProjection({ clusterKey: key, projection });
    } catch (err) {
      console.error('Failed to project atmospheric dispersal cone:', err);
    } finally {
      setProjectingCluster(null);
    }
  };

  const toggle = (
    <button
      onClick={() => {
        setEnabled(prev => {
          if (prev) setActiveProjection(null);
          return !prev;
        });
      }}
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
      {enabled && (
        <>
          {(data || [])
            .filter((c: OutbreakCluster) => c.centroid)
            .map(c => {
              const clusterKey = `${c.district}-${c.diseaseLabel}`;
              const isPlumeActive = activeProjection?.clusterKey === clusterKey;
              const isCalculating = projectingCluster === clusterKey;

              return (
                <CircleMarker
                  key={clusterKey}
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
                    <div className="text-xs space-y-1.5 min-w-[200px]">
                      <div>
                        <p className="font-bold capitalize text-slate-100">
                          {c.diseaseLabel.replace(/_/g, ' ')} — {c.crop}
                        </p>
                        <p className="text-slate-300 text-[11px]">
                          {c.caseCount} cases · {c.distinctFarmers} farms · {c.district}
                        </p>
                        <p className="text-gray-400 text-[10px]">
                          Last 14 days (anonymized, k≥3{c.differentialPrivacyApplied ? ', ε=1.0 DP' : ''})
                        </p>
                      </div>

                      <div className="pt-1.5 border-t border-white/10">
                        <button
                          type="button"
                          disabled={isCalculating}
                          onClick={() => handleTogglePlume(c)}
                          className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isPlumeActive
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                          }`}
                        >
                          {isCalculating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Modeling Dispersal...</span>
                            </>
                          ) : isPlumeActive ? (
                            <>
                              <Wind className="w-3.5 h-3.5" />
                              <span>Hide Spore Plume</span>
                            </>
                          ) : (
                            <>
                              <Wind className="w-3.5 h-3.5" />
                              <span>Project Spore Plume (CE-002)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

          {/* Active Atmospheric Spore Dispersal Cone Footprint (CE-002) */}
          {activeProjection && activeProjection.projection.coneFootprint && (
            <Polygon
              positions={activeProjection.projection.coneFootprint.map(pt => [pt.lat, pt.lng])}
              pathOptions={{
                color:
                  activeProjection.projection.riskLevel === 'CRITICAL'
                    ? '#ef4444'
                    : activeProjection.projection.riskLevel === 'HIGH'
                    ? '#f97316'
                    : '#eab308',
                fillColor:
                  activeProjection.projection.riskLevel === 'CRITICAL'
                    ? '#ef4444'
                    : activeProjection.projection.riskLevel === 'HIGH'
                    ? '#f97316'
                    : '#eab308',
                fillOpacity: 0.28,
                weight: 2,
                dashArray: '6, 6',
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 font-mono">
                  <p className="font-bold text-amber-300 uppercase tracking-wider">
                    Spore Dispersal Cone (CE-002)
                  </p>
                  <p className="text-slate-200">
                    Risk: <span className="font-bold">{activeProjection.projection.riskLevel}</span> (Viability: {Math.round(activeProjection.projection.viabilityScore * 100)}%)
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    Distance: {activeProjection.projection.dispersionDistanceKm.toFixed(1)} km · Aperture: {activeProjection.projection.apertureDegrees}°
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Wind: {activeProjection.projection.environmentalFactors.windSpeedKmH} km/h @ {activeProjection.projection.environmentalFactors.windBearingDeg}°
                  </p>
                  <p className="text-slate-500 text-[9px]">
                    Model: {activeProjection.projection.modelProvenance.methodology}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveProjection(null)}
                    className="mt-1 text-[11px] text-red-400 hover:text-red-300 underline block cursor-pointer"
                  >
                    Clear Plume
                  </button>
                </div>
              </Popup>
            </Polygon>
          )}
        </>
      )}
    </>
  );
}
