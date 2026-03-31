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
    farmerId 
}) => {
    const [satelliteData, setSatelliteData] = useState<{ ndvi?: number; soilMoisture?: number; lastUpdated?: string } | null>(null);
    const [farmSize, setFarmSize] = useState(externalFarmSize);
    const [crops, setCrops] = useState<string[]>(externalCrops);

    useEffect(() => {
        if (!farmerId) return;

        const fetchSatellite = async () => {
            try {
                const { data } = await apiClient.get(`/external/satellite/${farmerId}`);
                if (data.success && data.data) {
                    setSatelliteData({
                        ndvi: data.data.ndvi,
                        soilMoisture: data.data.soilMoisture,
                        lastUpdated: data.data.timestamp,
                    });
                    if (data.data.farmSize) setFarmSize(data.data.farmSize);
                }
            } catch {
                // Satellite data unavailable — keep props
            }
        };

        fetchSatellite();
    }, [farmerId]);

    const ndviColor = satelliteData?.ndvi 
        ? satelliteData.ndvi > 0.6 ? 'text-emerald-400' : satelliteData.ndvi > 0.3 ? 'text-amber-400' : 'text-red-400'
        : 'text-primary-400/40';

    return (
        <div className="w-full h-96 relative bg-primary-900/10 rounded-[3rem] border border-white/5 overflow-hidden group">
            <div className="absolute inset-0 cyber-grid-premium opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-4xl font-black text-white/20 uppercase tracking-[0.5em] mb-4">
                        {crops.length > 0 ? crops[0] : 'Farm'} Sector
                    </p>
                    <p className="text-xs font-bold text-primary-400/40 uppercase tracking-widest">
                        {farmSize > 0 ? `Spatial Analysis: ${farmSize} Hectares Verified` : 'Awaiting Spatial Data Stream...'}
                    </p>
                    {satelliteData && (
                        <div className="mt-4 space-y-1">
                            {satelliteData.ndvi !== undefined && (
                                <p className={`text-xs font-bold ${ndviColor}`}>
                                    NDVI: {satelliteData.ndvi.toFixed(2)}
                                </p>
                            )}
                            {satelliteData.soilMoisture !== undefined && (
                                <p className="text-xs font-bold text-blue-400/60">
                                    Soil Moisture: {satelliteData.soilMoisture.toFixed(1)}%
                                </p>
                            )}
                            {satelliteData.lastUpdated && (
                                <p className="text-[10px] font-bold text-white/20">
                                    Updated: {new Date(satelliteData.lastUpdated).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Animated Dynamic Elements */}
            {farmSize > 0 && Array.from({ length: Math.min(Math.ceil(farmSize), 5) }).map((_, i) => (
                <div 
                    key={i}
                    className="absolute w-2 h-2 bg-emerald-500/40 rounded-full blur-sm animate-pulse"
                    style={{ 
                        top: `${20 + (i * 13) % 60}%`, 
                        left: `${20 + (i * 17) % 60}%`,
                        animationDelay: `${i * 300}ms`
                    }}
                />
            ))}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
    );
};

export default IsometricFarmOverview;
