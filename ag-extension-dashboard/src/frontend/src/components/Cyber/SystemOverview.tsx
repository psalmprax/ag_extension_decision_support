import React, { useEffect, useState } from 'react';
import apiClient from '@/api/client';

interface SystemIndicator {
    label: string;
    status: 'online' | 'stable' | 'warning' | 'error';
}

interface SystemOverviewProps {
    healthScore?: number;
    indicators?: SystemIndicator[];
}

const SystemOverview: React.FC<SystemOverviewProps> = ({ 
    healthScore: externalHealthScore, 
    indicators: externalIndicators 
}) => {
    const [healthScore, setHealthScore] = useState<number | undefined>(externalHealthScore);
    const [indicators, setIndicators] = useState<SystemIndicator[]>(externalIndicators || []);
    const [uptime, setUptime] = useState<string>('');

    useEffect(() => {
        if (externalHealthScore !== undefined) return;

        const fetchHealth = async () => {
            try {
                const { data } = await apiClient.get('/health');
                const dbOk = data.services?.database === 'connected';
                const cacheOk = data.services?.cache === 'connected';
                const score = (dbOk ? 50 : 0) + (cacheOk ? 30 : 0) + (data.status === 'healthy' ? 20 : 0);
                setHealthScore(score);
                setIndicators([
                    { label: 'Database', status: dbOk ? 'online' : 'error' },
                    { label: 'Cache (Redis)', status: cacheOk ? 'online' : 'warning' },
                    { label: 'API Server', status: data.status === 'healthy' ? 'stable' : 'error' },
                ]);
                if (data.uptime) {
                    const d = Math.floor(data.uptime / 86400);
                    const h = Math.floor((data.uptime % 86400) / 3600);
                    const m = Math.floor((data.uptime % 3600) / 60);
                    setUptime(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`);
                }
            } catch {
                setHealthScore(0);
                setIndicators([
                    { label: 'Database', status: 'error' },
                    { label: 'Cache (Redis)', status: 'error' },
                    { label: 'API Server', status: 'error' },
                ]);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, [externalHealthScore]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
            case 'stable': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse';
            case 'warning': return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
            case 'error': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse';
            default: return 'bg-white/20';
        }
    };

    return (
        <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full flex flex-col justify-between">
            <div>
                <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em] mb-8">SYSTEM HEALTH</h3>
                <div className="space-y-4">
                    {indicators.map((indicator, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(indicator.status)}`} />
                            <span className="text-xs font-bold text-white/60">{indicator.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="pt-8 border-t border-white/5 mt-8">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-black text-primary-300/20 uppercase tracking-widest mb-1">Health Score</p>
                        <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
                            {healthScore !== undefined ? healthScore : '—'}
                        </p>
                        {uptime && (
                            <p className="text-[10px] font-bold text-white/30 mt-1">Uptime: {uptime}</p>
                        )}
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                        <span className="text-primary-400 font-black text-xl">
                            {healthScore === undefined ? '—' : healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : 'D'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemOverview;
