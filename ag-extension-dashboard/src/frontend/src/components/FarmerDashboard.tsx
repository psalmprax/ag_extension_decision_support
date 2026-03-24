import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { Sprout, MessageSquare, Calendar, Bell, TrendingUp, Zap, ShieldAlert, LineChart, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchFarmerStats } from '@/api/farmerService';
import IsometricFarmOverview from './Cyber/IsometricFarmOverview';
import SimulationGantt from './Cyber/SimulationGantt';
import MaintenanceDiagnostics from './Cyber/MaintenanceDiagnostics';

export const FarmerDashboard: React.FC = () => {
  const { user, themeName, showContextMenu } = useAppStore();
  const { t } = useLanguage();

  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['farmer-stats'],
    queryFn: fetchFarmerStats,
    enabled: !!user
  });

  const farmerStats = statsResponse?.data;
  const isCyber = themeName === 'cyber';

  const stats = [
    {
      title: t('farmer_my_crops'),
      value: farmerStats?.crops && farmerStats.crops.length > 0
        ? farmerStats.crops.join(', ')
        : `${t('crop_maize')}, ${t('crop_beans')}`,
      icon: Sprout,
      color: 'text-primary-600',
      bg: 'bg-primary-100'
    },
    { title: t('farmer_next_visit'), value: t('farmer_next_visit_val'), icon: Calendar, color: 'text-secondary-600', bg: 'bg-secondary-100' },
    { title: t('farmer_ai_advisory'), value: t('farmer_new_tips', { count: 2 }), icon: MessageSquare, color: 'text-accent-600', bg: 'bg-accent-100' },
    { title: t('farmer_alerts'), value: `1 ${t('farmer_active_status', { defaultValue: 'Active' })}`, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  if (isCyber) {
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
            <p className="text-[10px] font-black text-primary-300/40 uppercase tracking-[0.3em]">System Status: Optimal</p>
            <p className="text-sm font-bold text-white tabular-nums mt-1">OCT 26, 2024 - 14:38 GMT</p>
          </div>
        </header>

        {/* Hero Isometric Overview */}
        <section className="animate-slide-up">
            <IsometricFarmOverview />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Simulation Widget */}
            <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <SimulationGantt 
                    items={farmerStats?.yieldHistory?.map((y: any, i: number) => ({
                        id: String(i),
                        label: `PHASE_${i+1}: ${y.crop || 'GROWTH'}`,
                        value: `${y.yield || 0} t/ha`,
                        percent: Math.min((y.yield || 0) * 10, 100)
                    }))}
                />
            </div>

            {/* Diagnostics Widget */}
            <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <MaintenanceDiagnostics />
            </div>
        </div>

        {/* Legacy Stats converted to Cyber Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
                { label: 'SOIL MOISTURE', value: farmerStats?.soilMoisture || '34%', icon: Zap, trend: '+2%' },
                { label: 'AVG TEMP', value: farmerStats?.avgTemp || '21°C', icon:TrendingUp, trend: 'Stable' },
                { label: 'PH LEVEL', value: farmerStats?.phLevel || '6.8', icon: LineChart, trend: 'Optimal' },
                { label: 'AI CONFIDENCE', value: farmerStats?.aiConfidence || '98%', icon: ShieldAlert, trend: 'High' }
            ].map((stat, i) => (
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
                        <span className="text-[10px] font-bold text-primary-300/40 tracking-widest leading-none mt-1">{stat.trend}</span>
                    </div>
                    <p className="text-[10px] font-black text-primary-300/40 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-white tabular-nums tracking-tighter">{stat.value}</p>
                </div>
            ))}
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t('farmer_greeting').replace('{name}', user?.firstName || 'Farmer')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('farmer_overview')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-theme-bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-xl transition-all group cursor-context-menu"
            onContextMenu={(e) => {
                e.preventDefault();
                showContextMenu({ x: e.clientX, y: e.clientY, entityType: 'stat', entityId: stat.title.toLowerCase().replace(' ', '_') });
            }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{stat.title}</p>
                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-3 ${stat.bg} dark:bg-opacity-10 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-theme-bg-card dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">{t('farmer_market_prices')}</h3>
          <div className="space-y-4">
            {[
              { crop: t('crop_white_maize_90kg'), price: t('price_val', { amount: '4,200', currency: 'KES' }), trend: '+5%' },
              { crop: t('crop_dry_beans_90kg'), price: t('price_val', { amount: '12,500', currency: 'KES' }), trend: '-2%' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800 transition-colors hover:border-primary-500/30">
                <span className="font-bold text-gray-700 dark:text-gray-300">{item.crop}</span>
                <div className="text-right">
                  <p className="font-black text-gray-900 dark:text-white">{item.price}</p>
                  <p className={`text-[10px] font-bold ${item.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-widest`}>{item.trend}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-10 rounded-[2.5rem] shadow-2xl shadow-primary-500/20 text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-3 tracking-tight">{t('farmer_ask_ai')}</h3>
            <p className="text-primary-100 mb-8 font-medium text-lg leading-relaxed max-w-sm">{t('farmer_ai_description')}</p>
            <button className="px-8 py-3 bg-white text-primary-700 font-bold rounded-2xl hover:bg-primary-50 transition-all shadow-xl active:scale-95">
              {t('farmer_start_chat')}
            </button>
          </div>
          <MessageSquare className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
        </div>
      </div>
    </div>
  );
};
