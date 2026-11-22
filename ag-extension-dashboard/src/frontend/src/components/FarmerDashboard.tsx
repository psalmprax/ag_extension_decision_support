import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { Sprout, MessageSquare, Calendar, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFarmerStats } from '@/api/farmerService';
import { CyberDashboard } from './farmer/CyberDashboard';
import { NormalDashboard } from './farmer/NormalDashboard';

/** The next visit as a date, or null when none is planned (the API sends "None"). */
function formatNextVisit(value: string | null | undefined): string | null {
  if (!value || value === 'None') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const FarmerDashboard: React.FC = () => {
  const { user, themeName } = useAppStore();
  const { t } = useLanguage();

  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['farmer-stats'],
    queryFn: fetchFarmerStats,
    enabled: !!user,
  });

  const farmerStats = statsResponse?.data;
  const isCyber = themeName === 'cyber';

  const stats = [
    {
      title: t('farmer_my_crops'),
      value:
        Array.isArray(farmerStats?.crops) && farmerStats.crops.length > 0
          ? farmerStats.crops.join(', ')
          : t('farmer_no_crops', { defaultValue: 'None recorded' }),
      icon: Sprout,
    },
    {
      title: t('farmer_next_visit'),
      value: formatNextVisit(farmerStats?.nextVisitDate) ?? t('farmer_no_visit', { defaultValue: 'None planned' }),
      icon: Calendar,
    },
    {
      title: t('farmer_ai_advisory'),
      value: farmerStats?.aiTipsCount
        ? t('farmer_new_tips', { count: farmerStats.aiTipsCount })
        : t('farmer_no_tips', { defaultValue: 'No new tips' }),
      icon: MessageSquare,
    },
    {
      title: t('farmer_alerts'),
      value: farmerStats?.alertsCount
        ? `${farmerStats.alertsCount} ${t('farmer_active_status', { defaultValue: 'Active' })}`
        : t('farmer_no_alerts', { defaultValue: 'No alerts' }),
      icon: Bell,
    },
  ];

  if (isCyber) {
    return (
      <CyberDashboard
        farmerStats={farmerStats as unknown as Record<string, unknown> | null | undefined}
      />
    );
  }

  return <NormalDashboard stats={stats} statsLoading={statsLoading} farm={farmerStats ?? null} />;
};
