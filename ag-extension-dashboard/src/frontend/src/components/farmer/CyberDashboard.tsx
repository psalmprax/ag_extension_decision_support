import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { Zap, TrendingUp, LineChart, ShieldAlert } from 'lucide-react';
import IsometricFarmOverview from '../Cyber/IsometricFarmOverview';
import CropCycleGantt from '../Cyber/CropCycleGantt';
import SystemOverview from '../Cyber/SystemOverview';

interface CyberDashboardProps {
  farmerStats: Record<string, unknown> | null | undefined;
}

const getSoilTrend = (soil: unknown): string => {
  if (!soil) return 'No data';
  return Number(String(soil).replace('%', '')) > 30 ? 'Optimal' : 'Low';
};

const getPhTrend = (ph: unknown): string => {
  if (!ph) return 'No data';
  const num = Number(ph);
  return num > 6 && num < 8 ? 'Optimal' : 'Checking';
};

const getAiTrend = (ai: unknown): string => {
  if (!ai) return 'No data';
  return Number(String(ai).replace('%', '')) > 80 ? 'High' : 'Normal';
};

const getTempTrend = (temp: unknown): string => {
  if (!temp) return 'No data';
  return 'Stable';
};

const getDashboardMetrics = (stats: Record<string, unknown> | null | undefined) => [
  {
    label: 'SOIL MOISTURE',
    value: (stats?.soilMoisture as string | undefined) ?? '\u2014',
    icon: Zap,
    trend: getSoilTrend(stats?.soilMoisture),
  },
  {
    label: 'AVG TEMP',
    value: (stats?.avgTemp as string | undefined) ?? '\u2014',
    icon: TrendingUp,
    trend: getTempTrend(stats?.avgTemp),
  },
  {
    label: 'PH LEVEL',
    value: (stats?.phLevel as string | undefined) ?? '\u2014',
    icon: LineChart,
    trend: getPhTrend(stats?.phLevel),
  },
  {
    label: 'AI CONFIDENCE',
    value: (stats?.aiConfidence as string | undefined) ?? '\u2014',
    icon: ShieldAlert,
    trend: getAiTrend(stats?.aiConfidence),
  },
];

export const CyberDashboard: React.FC<CyberDashboardProps> = ({ farmerStats }) => {
  const { user } = useAppStore();
  const { t } = useLanguage();
  const { showContextMenu } = useAppStore();

  const dashboardMetrics = getDashboardMetrics(farmerStats);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter text-glow uppercase">
            {t('farmer_greeting').replace('{name}', user?.firstName || 'Farmer')}
          </h1>
          <p className="text-primary-300/60 mt-1 font-bold uppercase tracking-widest text-xs">
            {t('farmer_overview')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xxs font-black text-primary-300/40 uppercase tracking-[0.3em]">
            System Status: {farmerStats ? 'Telemetry available' : 'Awaiting telemetry'}
          </p>
          <p className="text-sm font-bold text-white tabular-nums mt-1">
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </p>
        </div>
      </header>

      <section className="animate-slide-up">
        <IsometricFarmOverview
          farmSize={farmerStats?.['farmSize'] as number | undefined}
          crops={farmerStats?.['crops'] as string[] | undefined}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CropCycleGantt
            items={
              Array.isArray(farmerStats?.['yieldHistory'])
                ? (farmerStats['yieldHistory'] as Array<{ crop?: string; yield?: number }>).map(
                    (y, i) => ({
                      id: String(i),
                      label: `${y.crop || 'PHASE_' + (i + 1)}`,
                      value: `${y.yield || 0} t/ha`,
                      percent: Math.min((y.yield || 0) * 10, 100),
                    })
                  )
                : []
            }
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <SystemOverview
            healthScore={
              farmerStats?.['vitalScore'] !== undefined
                ? Number(((farmerStats['vitalScore'] as number) * 10).toFixed(1))
                : undefined
            }
            indicators={[
              {
                label: 'SOIL_ANALYSIS',
                status: farmerStats?.['soilMoisture'] ? 'online' : 'warning',
              },
              { label: 'AI_AGENT', status: farmerStats?.['aiConfidence'] ? 'stable' : 'online' },
              { label: 'PERSISTENCE', status: farmerStats ? 'online' : 'warning' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardMetrics.map((stat, i) => (
          <div
            key={i}
            className="glass-premium p-6 rounded-2xl border-white/5 group hover:border-primary-500/30 transition-all cursor-context-menu"
            onContextMenu={e => {
              e.preventDefault();
              showContextMenu({
                x: e.clientX,
                y: e.clientY,
                entityType: 'stat',
                entityId: stat.label.toLowerCase().replace(' ', '_'),
              });
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <stat.icon className="w-5 h-5 text-primary-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="text-xxs font-bold text-primary-300/40 tracking-widest leading-none mt-1">
                {stat.trend}
              </span>
            </div>
            <p className="text-xxs font-black text-primary-300/40 uppercase tracking-widest leading-none mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-black text-white tabular-nums tracking-tighter">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
