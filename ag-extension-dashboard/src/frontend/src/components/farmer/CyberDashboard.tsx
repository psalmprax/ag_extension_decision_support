import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { Zap, TrendingUp, LineChart, ShieldAlert } from 'lucide-react';
import IsometricFarmOverview from '../Cyber/IsometricFarmOverview';
import CropCycleGantt from '../Cyber/CropCycleGantt';
import SystemOverview from '../Cyber/SystemOverview';

interface CyberDashboardProps {
    farmerStats: unknown;
}

export const CyberDashboard: React.FC<CyberDashboardProps> = ({ farmerStats }) => {
    const { user } = useAppStore();
    const { t } = useLanguage();
    const { showContextMenu } = useAppStore();

    const dashboardMetrics = [
        { label: 'SOIL MOISTURE', value: farmerStats?.soilMoisture || '\u2014', icon: Zap, trend: farmerStats?.soilMoisture ? (Number(String(farmerStats.soilMoisture).replace('%','')) > 30 ? 'Optimal' : 'Low') : 'No data' },
        { label: 'AVG TEMP', value: farmerStats?.avgTemp || '\u2014', icon: TrendingUp, trend: farmerStats?.avgTemp ? 'Stable' : 'No data' },
        { label: 'PH LEVEL', value: farmerStats?.phLevel || '\u2014', icon: LineChart, trend: farmerStats?.phLevel ? (Number(farmerStats.phLevel) > 6 && Number(farmerStats.phLevel) < 8 ? 'Optimal' : 'Checking') : 'No data' },
        { label: 'AI CONFIDENCE', value: farmerStats?.aiConfidence || '\u2014', icon: ShieldAlert, trend: farmerStats?.aiConfidence ? (Number(String(farmerStats.aiConfidence).replace('%','')) > 80 ? 'High' : 'Normal') : 'No data' }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter text-glow uppercase">
                        {t('farmer_greeting').replace('{name}', user?.firstName || 'Farmer')}
                    </h1>
                    <p className="text-primary-300/60 mt-1 font-bold uppercase tracking-widest text-xs">{t('farmer_overview')}</p>
                </div>
                <div className="text-right">
                    <p className="text-xxs font-black text-primary-300/40 uppercase tracking-[0.3em]">System Status: Optimal</p>
                    <p className="text-sm font-bold text-white tabular-nums mt-1">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</p>
                </div>
            </header>

            <section className="animate-slide-up">
                <IsometricFarmOverview farmSize={farmerStats?.farmSize} crops={farmerStats?.crops} />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <CropCycleGantt
                        items={Array.isArray(farmerStats?.yieldHistory) ? farmerStats.yieldHistory.map((y: { crop?: string; yield?: number }, i: number) => ({
                            id: String(i),
                            label: `${y.crop || 'PHASE_' + (i+1)}`,
                            value: `${y.yield || 0} t/ha`,
                            percent: Math.min((y.yield || 0) * 10, 100)
                        })) : []}
                    />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <SystemOverview
                        healthScore={farmerStats?.vitalScore !== undefined ? Number((farmerStats.vitalScore * 10).toFixed(1)) : undefined}
                        indicators={[
                            { label: 'SOIL_ANALYSIS', status: farmerStats?.soilMoisture ? 'online' : 'warning' },
                            { label: 'AI_AGENT', status: farmerStats?.aiConfidence ? 'stable' : 'online' },
                            { label: 'PERSISTENCE', status: farmerStats ? 'online' : 'warning' }
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {dashboardMetrics.map((stat, i) => (
                    <div
                        key={i}
                        className="glass-premium p-6 rounded-2xl border-white/5 group hover:border-primary-500/30 transition-all cursor-context-menu"
                        onContextMenu={(e) => {
                            e.preventDefault();
                            showContextMenu({ x: e.clientX, y: e.clientY, entityType: 'stat', entityId: stat.label.toLowerCase().replace(' ', '_') });
                        }}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <stat.icon className="w-5 h-5 text-primary-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xxs font-bold text-primary-300/40 tracking-widest leading-none mt-1">{stat.trend}</span>
                        </div>
                        <p className="text-xxs font-black text-primary-300/40 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-white tabular-nums tracking-tighter">{stat.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
