import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import type { PaidService } from '@/lib/planAccess';
import {
  fetchServiceAccess,
  grantServiceAccess,
  revokeServiceAccess,
  type ServiceGrant,
} from '@/api/serviceAccessService';

interface ServiceAccessSectionProps {
  userId: string;
}

/** The end of the picked calendar day, in the administrator's time zone. */
const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

/**
 * System administrator only: open one paid service to this account (for example a
 * Free farmer messaging their officer) without changing its plan. Takes effect at once.
 */
export function ServiceAccessSection({ userId }: ServiceAccessSectionProps) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const queryKey = ['service-access', userId];
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const access = useQuery({ queryKey, queryFn: () => fetchServiceAccess(userId) });

  const change = useMutation({
    mutationFn: ({ service, grant }: { service: PaidService; grant: boolean }) =>
      grant ? grantServiceAccess(userId, service, until ? endOfDay(until) : null) : revokeServiceAccess(userId, service),
    onMutate: () => setError(''),
    onSuccess: active => {
      queryClient.setQueryData(queryKey, { ...access.data!, active });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: err => setError(getApiErrorMessage(err, t('users_service_access_error', 'The change was not saved. Try again.'))),
  });

  const grantFor = (service: PaidService): ServiceGrant | undefined => access.data?.active.find(g => g.service === service);
  const describe = (grant: ServiceGrant | undefined) => {
    if (!grant) return t('users_service_access_none', 'Not granted');
    if (!grant.expiresAt) return t('users_service_access_open', 'Granted, no end date');
    const date = new Date(grant.expiresAt).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
    return t('users_service_access_until', { defaultValue: 'Granted until {date}', date });
  };

  if (access.isLoading) {
    return <p className="text-xs text-white/60">{t('users_service_access_loading', 'Loading service access…')}</p>;
  }
  if (access.isError || !access.data) {
    return <p className="text-xs text-rose-300">{t('users_service_access_load_error', 'Service access could not be loaded.')}</p>;
  }
  if (!access.data.grantable.length) return null;

  return (
    <fieldset className="space-y-3 rounded-lg border border-white/10 p-3">
      <legend className="px-1 text-xs font-medium text-white/80 flex items-center gap-1.5">
        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
        {t('users_service_access_title', 'Service access')}
      </legend>
      <p className="text-[11px] text-white/60">
        {t('users_service_access_hint', 'Lets this account use a paid service without changing its plan.')}
      </p>
      <label className="flex items-center justify-between gap-3 text-[11px] text-white/70">
        <span>{t('users_service_access_until_label', 'New grants end on (optional)')}</span>
        <input
          type="date"
          value={until}
          min={new Date().toISOString().slice(0, 10)}
          onChange={e => setUntil(e.target.value)}
          className="px-2 py-1 rounded-md border border-white/10 bg-slate-900 text-white text-xs"
        />
      </label>
      <ul className="space-y-2">
        {access.data.grantable.map(({ service, label }) => {
          const grant = grantFor(service);
          const busy = change.isPending && change.variables?.service === service;
          return (
            <li key={service} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white">{t(`paid_service_${service}`, label)}</p>
                <p className="text-[11px] text-white/60">{describe(grant)}</p>
              </div>
              <button
                type="button"
                disabled={change.isPending}
                onClick={() => change.mutate({ service, grant: !grant })}
                aria-label={`${grant ? t('users_service_access_revoke', 'Revoke') : t('users_service_access_grant', 'Grant')}: ${t(`paid_service_${service}`, label)}`}
                className={
                  grant
                    ? 'px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:text-white text-xs flex items-center gap-1.5 disabled:opacity-50'
                    : 'px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5 disabled:opacity-50'
                }
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                {grant ? t('users_service_access_revoke', 'Revoke') : t('users_service_access_grant', 'Grant')}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </fieldset>
  );
}
