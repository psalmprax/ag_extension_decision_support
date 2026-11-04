import React, { useEffect, useState } from 'react';
import apiClient from '@/api/client';

interface IsometricFarmOverviewProps {
  farmSize?: number;
  crops?: string[];
  farmerId?: string;
}

const IsometricFarmOverview: React.FC<IsometricFarmOverviewProps> = ({
  farmSize: externalFarmSize = 0,
  crops: externalCrops = [],
  farmerId,
}) => {
  const [satelliteData, setSatelliteData] = useState<{
    ndvi?: number;
    soilMoisture?: number;
    lastUpdated?: string;
  } | null>(null);
  const [farmSize, setFarmSize] = useState(externalFarmSize);
  const [crops, _setCrops] = useState<string[]>(externalCrops);

  useEffect(() => {
    if (!farmerId) return;

    const fetchSatellite = async () => {
      try {
        const res = await apiClient.get(`/external/satellite/${farmerId}`);
        if (res.data?.success && res.data.data) {
          setSatelliteData({
            ndvi: res.data.data.ndvi,
            soilMoisture: res.data.data.soilMoisture,
            lastUpdated: res.data.data.timestamp,
          });
          if (res.data.data.farmSize) setFarmSize(res.data.data.farmSize);
        } else {
          setSatelliteData(null);
        }
      } catch (error) {
        setSatelliteData(null);
        if (import.meta.env.DEV) {
          console.warn('Satellite telemetry unavailable:', error);
        }
      }
    };

    fetchSatellite();
  }, [farmerId, externalFarmSize]);

  const ndviColor = satelliteData?.ndvi
    ? satelliteData.ndvi > 0.6
      ? 'text-emerald-400'
      : satelliteData.ndvi > 0.3
        ? 'text-amber-400'
        : 'text-red-400'
    : 'text-primary-400/40';

  return (
    <div className="w-full h-96 relative bg-primary-900/10 rounded-xl border border-white/5 overflow-hidden group">
      <div className="absolute inset-0 cyber-grid-premium opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white/40 tracking-normal mb-3">
            {crops.length > 0 ? crops[0] : 'Farm'} Sector
          </p>
          <p className="text-xs font-medium text-slate-400">
            {farmSize > 0
              ? `Spatial Analysis: ${farmSize} Hectares Verified`
              : 'Awaiting Spatial Data Stream...'}
          </p>
          {satelliteData && (
            <div className="mt-4 space-y-1">
              {satelliteData.ndvi !== undefined && (
                <p className={`text-xs font-medium font-mono tabular-nums ${ndviColor}`}>
                  NDVI: {satelliteData.ndvi.toFixed(2)}
                </p>
              )}
              {satelliteData.soilMoisture !== undefined && (
                <p className="text-xs font-medium font-mono tabular-nums text-blue-400/60">
                  Soil Moisture: {satelliteData.soilMoisture.toFixed(1)}%
                </p>
              )}
              {satelliteData.lastUpdated && (
                <p className="text-xs font-medium font-mono tabular-nums text-white/40">
                  Updated: {new Date(satelliteData.lastUpdated).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Animated Dynamic Elements */}
      {farmSize > 0 &&
        Array.from({ length: Math.min(Math.ceil(farmSize), 5) }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-emerald-400/40 rounded-full"
            style={{
              top: `${20 + ((i * 13) % 60)}%`,
              left: `${20 + ((i * 17) % 60)}%`,
            }}
          />
        ))}
    </div>
  );
};

export default IsometricFarmOverview;
