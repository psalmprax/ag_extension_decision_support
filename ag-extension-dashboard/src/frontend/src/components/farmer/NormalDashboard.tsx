import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketPrices, MarketPrice } from '@/api/priceService';
import { MetricCardSkeleton, ChartSkeleton } from '../Skeleton';

interface NormalDashboardProps {
  stats: Array<{
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
    bg: string;
  }>;
  statsLoading: boolean;
}

export const NormalDashboard: React.FC<NormalDashboardProps> = ({ stats, statsLoading }) => {
  const { user, showContextMenu, setActiveTab } = useAppStore();
  const { t } = useLanguage();

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
    enabled: !!user,
  });

  if (statsLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <header>
          <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-5 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartSkeleton />
          <div className="bg-gray-200 dark:bg-gray-700 h-[300px] rounded-[2.5rem] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          {t('farmer_greeting').replace('{name}', user?.firstName || 'Farmer')}
        </h1>
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
            onContextMenu={e => {
              e.preventDefault();
              showContextMenu({
                x: e.clientX,
                y: e.clientY,
                entityType: 'stat',
                entityId: stat.title.toLowerCase().replace(' ', '_'),
              });
            }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xxs font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                  {stat.title}
                </p>
                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  {stat.value}
                </p>
              </div>
              <div
                className={`p-3 ${stat.bg} dark:bg-opacity-10 rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-theme-bg-card dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
            {t('farmer_market_prices')}
          </h3>
          <div className="space-y-4">
            {pricesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : prices && prices.length > 0 ? (
              prices.map((item: MarketPrice, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-theme-bg-secondary/50 dark:bg-gray-900/50 rounded-xl border border-gray-50 dark:border-gray-800 transition-colors hover:border-primary-500/30"
                >
                  <span className="font-bold text-gray-700 dark:text-gray-300">{item.crop}</span>
                  <div className="text-right">
                    <p className="font-black text-gray-900 dark:text-white">{item.price}</p>
                    <p
                      className={`text-xxs font-bold ${String(item.trend || '').startsWith('+') ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-widest`}
                    >
                      {item.trend}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs font-bold uppercase tracking-widest">
                No price data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-10 rounded-[2.5rem] shadow-2xl shadow-primary-500/20 text-white relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-3 tracking-tight">{t('farmer_ask_ai')}</h3>
            <p className="text-primary-100 mb-8 font-medium text-lg leading-relaxed max-w-sm">
              {t('farmer_ai_description')}
            </p>
            <button
              onClick={() => setActiveTab('aiassistant')}
              className="px-8 py-3 bg-white text-primary-700 font-bold rounded-2xl hover:bg-primary-50 transition-all shadow-xl active:scale-95"
            >
              {t('farmer_start_chat')}
            </button>
          </div>
          <MessageSquare className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
        </div>
      </div>
    </div>
  );
};
