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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
    case 'stable':
      return 'bg-status-success shadow-glow-success animate-pulse';
    case 'warning':
      return 'bg-status-warning shadow-glow-warning';
    case 'error':
      return 'bg-status-error shadow-glow-error animate-pulse';
    default:
      return 'bg-white/20';
  }
};

const getHealthGrade = (score?: number) => {
  if (score === undefined) return '—';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
};

const formatUptime = (uptime: number) => {
  const d = Math.floor(uptime / 86400);
  const h = Math.floor((uptime % 86400) / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fetchSystemHealth = async (
  setHealthScore: (score: number) => void,
  setIndicators: (indicators: SystemIndicator[]) => void,
  setUptime: (uptime: string) => void
) => {
  try {
    const { data } = await apiClient.get('/health');
    const dbOk = data.services?.database === 'connected';
    const cacheOk = data.services?.cache === 'connected';
    let score = 0;
    if (dbOk) score += 50;
    if (cacheOk) score += 30;
    if (data.status === 'healthy') score += 20;

    setHealthScore(score);
    setIndicators([
      { label: 'Database', status: dbOk ? 'online' : 'error' },
      { label: 'Cache (Redis)', status: cacheOk ? 'online' : 'warning' },
      { label: 'API Server', status: data.status === 'healthy' ? 'stable' : 'error' },
    ]);

    if (data.uptime) {
      setUptime(formatUptime(data.uptime));
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

const useSystemHealth = (externalHealthScore?: number, externalIndicators?: SystemIndicator[]) => {
  const [healthScore, setHealthScore] = useState<number | undefined>(externalHealthScore);
  const [indicators, setIndicators] = useState<SystemIndicator[]>(externalIndicators || []);
  const [uptime, setUptime] = useState<string>('');

  useEffect(() => {
    if (externalHealthScore !== undefined) return;

    const updateHealth = () => fetchSystemHealth(setHealthScore, setIndicators, setUptime);

    updateHealth();
    const interval = setInterval(updateHealth, 30000);
    return () => clearInterval(interval);
  }, [externalHealthScore]);

  return { healthScore, indicators, uptime };
};

const SystemOverview: React.FC<SystemOverviewProps> = ({
  healthScore: externalHealthScore,
  indicators: externalIndicators,
}) => {
  const { healthScore, indicators, uptime } = useSystemHealth(
    externalHealthScore,
    externalIndicators
  );

  return (
    <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em] mb-8">
          SYSTEM HEALTH
        </h3>
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
            <p className="text-xxs font-black text-primary-300/20 uppercase tracking-widest mb-1">
              Health Score
            </p>
            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
              {healthScore !== undefined ? healthScore : '—'}
            </p>
            {uptime && <p className="text-xxs font-bold text-white/30 mt-1">Uptime: {uptime}</p>}
          </div>
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
            <span className="text-primary-400 font-black text-xl">
              {getHealthGrade(healthScore)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;
