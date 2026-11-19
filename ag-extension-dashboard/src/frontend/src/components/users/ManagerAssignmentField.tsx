import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';

interface RegionalManagerOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  region: string | null;
}

interface ManagerAssignmentFieldProps {
  managerId: string | null;
  isDemo: boolean;
  onChange: (managerId: string | null) => void;
}

/**
 * Links an extension officer to the regional manager they report to. Public
 * signup and the real-world seed populate this automatically; this control
 * repairs accounts whose region had no manager at signup, and reassigns an
 * officer after a boundary change.
 */
export function ManagerAssignmentField({ managerId, isDemo, onChange }: ManagerAssignmentFieldProps) {
  const { t } = useLanguage();
  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'regional_manager'],
    enabled: !isDemo,
    queryFn: async () => {
      const res = await apiClient.get('/users/role/regional_manager');
      const raw = res.data?.data;
      return (Array.isArray(raw) ? raw : []) as RegionalManagerOption[];
    },
  });

  return (
    <div className="space-y-1">
      <label htmlFor="access-manager-select" className="text-xs font-medium text-white/70">
        {t('users_access_manager', 'Reports to')}
      </label>
      <select
        id="access-manager-select"
        value={managerId ?? ''}
        disabled={isLoading}
        onChange={e => onChange(e.target.value || null)}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
      >
        <option value="">{t('users_access_manager_none', 'No regional manager')}</option>
        {(managers ?? []).map(manager => (
          <option key={manager.id} value={manager.id}>
            {manager.firstName} {manager.lastName}
            {manager.region ? ` — ${manager.region}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
