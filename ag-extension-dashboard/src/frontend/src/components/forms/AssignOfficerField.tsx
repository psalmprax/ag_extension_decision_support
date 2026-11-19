import { useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';

interface OfficerOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  region: string | null;
}

interface AssignOfficerFieldProps {
  value: string;
  onChange: (officerId: string) => void;
}

/**
 * Lets an admin or regional manager choose the extension officer a new farmer
 * is assigned to. The server lists only active, real officers, and for a
 * regional manager only officers in their own region (it also refuses any
 * other officer on submit). Leaving it empty keeps the farmer unassigned.
 */
export function AssignOfficerField({ value, onChange }: AssignOfficerFieldProps) {
  const { t } = useLanguage();
  const { data: officers, isLoading, isError } = useQuery({
    queryKey: ['users', 'extension_officer'],
    queryFn: async () => {
      const res = await apiClient.get('/users/role/extension_officer');
      const raw = res.data?.data;
      return (Array.isArray(raw) ? raw : []) as OfficerOption[];
    },
  });

  return (
    <div className="space-y-1.5">
      <label htmlFor="farmer-assign-officer" className="block text-xs font-medium text-white/70">
        {t('farmer_register_assign_officer', 'Assigned extension officer')}
      </label>
      <div className="relative">
        <UserCheck className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
        <select
          id="farmer-assign-officer"
          value={value}
          disabled={isLoading}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-white/10 bg-slate-900 text-white focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm disabled:opacity-60"
        >
          <option value="">{t('farmer_register_officer_none', 'Unassigned for now')}</option>
          {(officers ?? []).map(officer => (
            <option key={officer.id} value={officer.id}>
              {officer.firstName} {officer.lastName}
              {officer.region ? ` — ${officer.region}` : ''}
            </option>
          ))}
        </select>
      </div>
      {isError && (
        <p className="text-xs text-rose-400">
          {t('farmer_register_officers_failed', 'Could not load officers. The farmer can be assigned later.')}
        </p>
      )}
    </div>
  );
}
