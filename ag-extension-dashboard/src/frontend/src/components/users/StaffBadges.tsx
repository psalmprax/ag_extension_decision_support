import { Shield, Crown } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface StaffBadgesProps {
  roleLabel: string;
  roleClass: string;
  /** Demo-session account; the API only sends these to admins. */
  isDemo?: boolean;
  planName?: string | null;
  isFree?: boolean;
  isActive?: boolean | null;
}

function getPlanBadgeClass(planName: string, isFree?: boolean): string {
  const normalized = planName.trim().toLowerCase();
  if (normalized === 'enterprise' || normalized === 'admin') {
    return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30';
  }
  if (!isFree && normalized !== 'free') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10';
}

/** Role, subscription tier, account status, and demo badges for staff cards. */
export function StaffBadges({
  roleLabel,
  roleClass,
  isDemo,
  planName,
  isFree,
  isActive,
}: StaffBadgesProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium capitalize border ${roleClass}`}>
        <Shield className="w-2.5 h-2.5" aria-hidden="true" />
        {roleLabel}
      </span>
      {planName && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getPlanBadgeClass(planName, isFree)}`}
        >
          <Crown className="w-2.5 h-2.5" aria-hidden="true" />
          {planName}
        </span>
      )}
      {isActive === false && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
          {t('ui_staff_badges_inactive')}
        </span>
      )}
      {isDemo && (
        <span
          title="Shared demo login. Its data is hidden from real accounts."
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
        >
          {t('ui_index_demo')}
        </span>
      )}
    </div>
  );
}
