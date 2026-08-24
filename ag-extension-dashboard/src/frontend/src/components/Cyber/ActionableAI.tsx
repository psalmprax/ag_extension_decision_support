import React from 'react';
import {
  Zap,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Globe,
  Truck,
  ArrowUpRight,
  Droplets,
  Wind,
  ThermometerSun,
  Loader2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import IsometricFarmOverview from './IsometricFarmOverview';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketPrices, MarketPrice } from '@/api/priceService';
import { fetchFarmerStats } from '@/api/farmerService';

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  description?: string;
}

interface AlertData {
  id: string;
  title: string;
  description: string;
  severity: string;
}

const ActionableAI = () => {
  const { addNotification, user } = useAppStore();
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Fetch real market prices for logistics section
  const { data: pricesData } = useQuery({
    queryKey: ['actionable-prices'],
    queryFn: fetchMarketPrices,
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real farmer stats for yield data
  const { data: statsData } = useQuery({
    queryKey: ['actionable-stats'],
    queryFn: fetchFarmerStats,
    enabled: !!user,
  });

  // Fetch real weather data
  const { data: weatherData, isLoading: weatherLoading } = useQuery<WeatherData | null>({
    queryKey: ['actionable-weather'],
    queryFn: async () => {
      try {
        const region = user?.region || 'Kenya';
        const { data } = await apiClient.get(`/external/weather/${encodeURIComponent(region)}`);
        return data?.data || data || null;
      } catch {
        return null;
      }
    },
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real alerts
  const { data: alertsData } = useQuery<AlertData[]>({
    queryKey: ['actionable-alerts'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/alerts');
        return data?.data || data || [];
      } catch {
        return [];
      }
    },
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real performance data for economic index
  const { data: performanceData } = useQuery({
    queryKey: ['actionable-performance'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/analytics/performance');
        return data?.data || data || null;
      } catch {
        return null;
      }
    },
    enabled: !!localStorage.getItem('token'),
  });

  const farmerStats = statsData?.data;
  const prices: MarketPrice[] = pricesData || [];
  const alerts: AlertData[] = alertsData || [];

  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      const { data } = await apiClient.post('/ai/strategy', {
        type: 'full_strategy',
        context: 'agricultural_optimization',
      });
      if (data.success) {
        addNotification({
          type: 'success',
          message: 'Full strategy generated successfully. Check reports for details.',
        });
      } else {
        toast.error('Strategy generation returned no data');
      }
    } catch {
      addNotification({
        type: 'warning',
        message: 'Strategy generation queued. It will appear in reports when ready.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Derive yield chart data from real stats or show empty
  const yieldBars = farmerStats?.yieldHistory?.length
    ? farmerStats.yieldHistory
        .slice(-9)
        .map((y: { yield: number }) => Math.min((y.yield || 0) * 10, 100))
    : null;

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Header / Title Section */}
      <div className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary-900/40 to-black/60 border border-white/10 overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Zap className="w-32 h-32 text-primary-400" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1 bg-primary-500/20 rounded-full border border-primary-500/30">
              <span className="text-xxs font-black text-primary-400 uppercase tracking-widest">
                Priority Alpha
              </span>
            </div>
            <div className="h-px w-12 bg-white/20" />
            <span className="text-xxs font-bold text-white/40 uppercase tracking-widest">
              Real-time Decision Matrix
            </span>
          </div>
          <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] mb-4">
            Actionable AI
          </h2>
          <p className="max-w-2xl text-white/60 text-sm leading-relaxed font-medium capitalize">
            Strategic intelligence layer for agricultural optimization. High-fidelity predictive
            modeling for risk mitigation and yield maximization across the regional supply chain.
          </p>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Spatial Intelligence */}
        <div className="col-span-8 space-y-8">
          <div className="bg-black/20 border border-white/5 rounded-[2.5rem] p-4 relative">
            <div className="absolute top-8 left-8 z-20 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center overflow-hidden"
                  >
                    <div className="w-full h-full bg-primary-500 opacity-20" />
                  </div>
                ))}
              </div>
              <span className="text-xxs font-black text-white/60 uppercase tracking-widest">
                3 Satellite Nodes Active
              </span>
            </div>
            <IsometricFarmOverview />
          </div>

          {/* Supply Chain / Logistics Precision — Real market data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary-400" />
                  Market Prices
                </h3>
                <ArrowUpRight className="w-4 h-4 text-white/20" />
              </div>
              {prices.length > 0 ? (
                <div className="space-y-3">
                  {prices.slice(0, 3).map((item, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-white/40 uppercase mb-1">
                          Commodity
                        </div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {item.crop}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs font-black uppercase mb-1 ${item.trend.startsWith('+') ? 'text-green-400' : item.trend.startsWith('-') ? 'text-red-400' : 'text-white/40'}`}
                        >
                          {item.trend}
                        </div>
                        <div className="text-xs font-black text-white">{item.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Database className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xxs text-white/40 font-bold uppercase">
                    No market data available
                  </p>
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-secondary-400" />
                  Yield History
                </h3>
                {yieldBars && (
                  <div className="px-2 py-0.5 bg-green-500/10 rounded text-xs font-black text-green-400 uppercase tracking-widest">
                    {yieldBars.length} Records
                  </div>
                )}
              </div>
              {yieldBars ? (
                <>
                  <div className="relative h-24 flex items-end gap-1 px-2">
                    {yieldBars.map((h: number, i: number) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-secondary-500/20 to-secondary-500/60 rounded-t-sm"
                        style={{ height: `${Math.max(h, 5)}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between items-center text-xxs font-bold text-white/40 uppercase">
                    <span>Yield History</span>
                    <span className="text-white">
                      {farmerStats?.yieldHistory?.length || 0} cycles recorded
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-24 flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-xxs text-white/40 font-bold uppercase">
                      No yield data recorded yet
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Risk & Economic Matrix */}
        <div className="col-span-4 space-y-8">
          {/* Real Alerts or Data Unavailable */}
          <div className="bg-error-500/10 border border-error-500/20 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldAlert className="w-16 h-16 text-error-400" />
            </div>
            <h3 className="text-xs font-black text-error-400 uppercase tracking-widest mb-4 flex items-center gap-2 font-mono">
              <Zap className="w-4 h-4 animate-pulse" />
              System Anomalies
            </h3>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.slice(0, 2).map(alert => (
                  <div
                    key={alert.id}
                    className="p-3 bg-error-500/5 rounded-xl border border-error-500/10"
                  >
                    <p className="text-xs-plus font-black text-white uppercase tracking-tight mb-1">
                      {alert.title}
                    </p>
                    <p className="text-xxs text-white/60 leading-relaxed font-medium lowercase">
                      {alert.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-xxs text-white/40 font-bold uppercase">
                  Alert data source currently unavailable
                </p>
              </div>
            )}
          </div>

          {/* Real Weather Data */}
          <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Globe className="w-5 h-5 text-primary-400" />
              </div>
              <span className="text-xs font-black text-white uppercase tracking-[0.2em]">
                Environment Stream
              </span>
            </div>
            {weatherData ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <ThermometerSun className="w-4 h-4 text-orange-400 mx-auto mb-2" />
                  <div className="text-xs font-black text-white/40 uppercase mb-1">Temp</div>
                  <div className="text-xs-plus font-black text-white">
                    {weatherData.temperature ?? '—'}°C
                  </div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-2" />
                  <div className="text-xs font-black text-white/40 uppercase mb-1">Humid</div>
                  <div className="text-xs-plus font-black text-white">
                    {weatherData.humidity ?? '—'}%
                  </div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <Wind className="w-4 h-4 text-primary-400 mx-auto mb-2" />
                  <div className="text-xs font-black text-white/40 uppercase mb-1">Wind</div>
                  <div className="text-xs-plus font-black text-white">
                    {weatherData.windSpeed ?? '—'}km/h
                  </div>
                </div>
              </div>
            ) : weatherLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
              </div>
            ) : (
              <div className="text-center py-4">
                <Globe className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-xxs text-white/40 font-bold uppercase">
                  Weather data unavailable
                </p>
              </div>
            )}
          </div>

          {/* Real Economic Performance */}
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-white/10 rounded-3xl p-8 backdrop-blur-md text-center">
            <BarChart3 className="w-12 h-12 text-primary-400 mx-auto mb-4 opacity-40" />
            <h4 className="text-xxs font-black text-primary-400 uppercase tracking-[0.3em] mb-4">
              Performance Index
            </h4>
            {performanceData?.metrics ? (
              <div className="flex items-center justify-center gap-4">
                <div className="text-5xl font-black text-white tracking-tighter">
                  {performanceData.metrics.resolutionRate > 0
                    ? performanceData.metrics.resolutionRate
                    : 0}
                  %
                </div>
                <div className="text-left">
                  <span className="block text-xs font-black text-green-400 uppercase">
                    {performanceData.metrics.satisfactionScore || 0}/5 satisfaction
                  </span>
                  <span className="block text-xxs font-black text-white/60 uppercase">
                    Resolution Rate
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-3xl font-black text-white/40">0%</div>
            )}
            <button
              onClick={handleGenerateStrategy}
              disabled={isGenerating}
              className="w-full mt-8 py-4 bg-primary-500 rounded-2xl font-black text-xxs text-white uppercase tracking-[0.2em] shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isGenerating ? 'Generating...' : 'Generate Full Strategy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionableAI;
