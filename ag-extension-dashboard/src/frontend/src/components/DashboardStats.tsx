import React, { useState, useEffect } from 'react';
import { useDesign } from '@/hooks/useDesignVariant';
import { useLanguage } from '@/lib/LanguageContext';
import { Users, Calendar, MessageSquare, TrendingUp } from 'lucide-react';
import { fetchDashboardData, DashboardResponse } from '@/api/dashboardService';
import { withRealFallback } from '@/lib/realFirst';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
}

const CurrentStatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon }) => (
  <div className="bg-theme-bg-card dark:bg-gray-800 p-4 border border-gray-100 dark:border-gray-700 shadow-sm" style={{ borderRadius: 'var(--radius-card)' }}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-gray-500" />
      <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{title}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    {change && <div className="text-xs text-gray-400 mt-1">{change}</div>}
  </div>
);

const NewStatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon }) => (
  <div className="bg-theme-bg-card dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1" 
       style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-premium)' }}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.15em] mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{title}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">{value}</p>
        {change && (
          <p className="text-xs font-bold text-primary-600 dark:text-primary-400 mt-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {change}
          </p>
        )}
      </div>
      <div className="p-3.5 bg-primary-50 dark:bg-primary-900/30 rounded-2xl shadow-inner">
        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
      </div>
    </div>
  </div>
);


export const DashboardStats: React.FC = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState([
    { title: 'Total Farmers', value: '...', change: '', icon: Users },
    { title: 'Visits This Month', value: '...', change: '', icon: Calendar },
    { title: 'Active Chats', value: '...', change: '', icon: MessageSquare },
  ]);

  useEffect(() => {
    const loadStats = async () => {
      const fallbackData = {
          overview: {
              totalFarmers: 1247,
              visitsThisMonth: 89,
              activeConversations: 342
          },
          trends: {
              farmersGrowth: 12,
              visitsGrowth: 5,
              conversationsGrowth: 8
          }
      };

      const dashboardData = await withRealFallback(fetchDashboardData(), fallbackData);
      
      if (dashboardData && dashboardData.overview) {
          const { overview, trends } = dashboardData;
          setStats([
            { 
                title: t('dashboard_total_farmers'), 
                value: overview.totalFarmers.toLocaleString(), 
                change: `+${trends.farmersGrowth}% from last month`, 
                icon: Users 
            },
            { 
                title: t('dashboard_visits_this_month'), 
                value: overview.visitsThisMonth.toLocaleString(), 
                change: `+${trends.visitsGrowth}% from last month`, 
                icon: Calendar 
            },
            { 
                title: t('dashboard_active_chats'), 
                value: overview.activeConversations.toLocaleString(), 
                change: `+${trends.conversationsGrowth}% from last month`, 
                icon: MessageSquare 
            },
          ]);
      }
    };

    loadStats();
  }, [t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const StatCard = useDesign({
          current: CurrentStatCard,
          new: NewStatCard,
        });
        return <StatCard key={index} {...stat} />;
      })}
    </div>
  );
};

export default DashboardStats;

