import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { Sprout, MessageSquare, Calendar, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFarmerStats } from '@/api/farmerService';
import { CyberDashboard } from './farmer/CyberDashboard';
import { NormalDashboard } from './farmer/NormalDashboard';

export const FarmerDashboard: React.FC = () => {
  const { user, themeName } = useAppStore();
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
      value: Array.isArray(farmerStats?.crops) && farmerStats.crops.length > 0
        ? farmerStats.crops.join(', ')
        : 'N/A',
      icon: Sprout,
      color: 'text-primary-600',
      bg: 'bg-primary-100'
    },
    { title: t('farmer_next_visit'), value: farmerStats?.nextVisitDate || 'TBD', icon: Calendar, color: 'text-secondary-600', bg: 'bg-secondary-100' },
    { title: t('farmer_ai_advisory'), value: farmerStats?.aiTipsCount ? t('farmer_new_tips', { count: farmerStats.aiTipsCount }) : '0 updates', icon: MessageSquare, color: 'text-accent-600', bg: 'bg-accent-100' },
    { title: t('farmer_alerts'), value: farmerStats?.alertsCount ? `${farmerStats.alertsCount} ${t('farmer_active_status', { defaultValue: 'Active' })}` : 'No alerts', icon: Bell, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  if (isCyber) {
    return <CyberDashboard farmerStats={farmerStats} />;
  }

  return <NormalDashboard stats={stats} statsLoading={statsLoading} />;
};
