import React, { useMemo } from 'react';
import { Camera, CalendarPlus, MapPinned, MessageSquare, UserPlus } from 'lucide-react';
import type { Farmer } from '@/types/dashboard';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import { useLanguage } from '@/lib/LanguageContext';
import { UnreadCount } from '@/components/chat/UnreadCount';
import { useDashboardZone, zoneOf } from '@/hooks/useDashboardZone';

const ACTION = 'flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-theme-bg-secondary/60 text-sm text-slate-800 dark:text-white/85 hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors';

/**
 * Field-staff shortcuts at the top of the dashboard: diagnose a crop photo,
 * register a farmer, schedule a visit, open farmer messages (with the unread
 * count), and focus the map on one village or district.
 */
export const DashboardToolbar: React.FC<{ farmers: Farmer[] }> = ({ farmers }) => {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const role = useAppStore(state => state.user?.role);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const { zone, setZone } = useDashboardZone();
  const zones = useMemo(
    () => Array.from(new Set(farmers.map(zoneOf).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [farmers]
  );
  if (role === 'farmer') return null;
  const fieldStaff = role === 'extension_officer' || role === 'regional_manager' || role === 'admin';

  return (
    <nav aria-label={t('dash_quick_actions', 'Quick actions')} className="flex flex-wrap items-center gap-2 mb-6">
      {(role === 'extension_officer' || role === 'admin') && (
        <button type="button" className={ACTION} onClick={() => setActiveTab('disease_diagnosis')}>
          <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          {t('dash_action_diagnose', 'Diagnose a crop photo')}
        </button>
      )}
      {fieldStaff && !isDemo && (
        <button type="button" className={ACTION} onClick={() => setActiveTab('register_farmer')}>
          <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          {t('portfolio_register_farmer', 'Register farmer')}
        </button>
      )}
      <button type="button" className={ACTION} onClick={() => setActiveTab('visits')}>
        <CalendarPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        {t('dash_action_visits', 'Plan visits')}
      </button>
      {role === 'extension_officer' && (
        <button type="button" className={ACTION} onClick={() => setActiveTab('farmerchat')}>
          <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          {t('dash_action_messages', 'Farmer messages')}
          <UnreadCount />
        </button>
      )}
      {zones.length > 1 && (
        <label className="flex items-center gap-2 ms-auto text-sm text-slate-700 dark:text-white/75">
          <MapPinned className="w-4 h-4" aria-hidden="true" />
          <span>{t('dash_zone', 'Zone')}</span>
          <select
            value={zone}
            onChange={e => setZone(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-theme-bg-secondary px-2 py-1.5 text-sm text-slate-900 dark:text-white"
          >
            <option value="">{t('dash_zone_all', 'All villages')}</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      )}
    </nav>
  );
};
