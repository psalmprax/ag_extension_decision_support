import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';
import { appLocale } from '@/lib/appLocale';

interface DemoVisit {
  createdAt: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  ipPrefix: string | null;
  device: string | null;
  locationSource: string | null;
}

interface DemoVisitsResponse {
  success: boolean;
  days: number;
  visits: DemoVisit[];
  byCountry: { countryCode: string | null; visits: number }[];
}

function countryName(code: string | null, unknown: string): string {
  if (!code) return unknown;
  try {
    return new Intl.DisplayNames([appLocale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Who opened the demo in the last 30 days, roughly: place from the visitor's IP (approximate;
 * VPNs and mobile networks often show another city) and the IP with its last part removed.
 * Admins only (the server refuses everyone else).
 */
export function DemoVisitsPanel() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const visits = useQuery({
    queryKey: ['admin-demo-visits'],
    enabled: open,
    queryFn: async () => (await apiClient.get<DemoVisitsResponse>('/demo-visits', { params: { days: 30 } })).data,
  });
  const unknown = t('demo_visits_unknown_place', { defaultValue: 'Unknown place' });

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-demo-visits"
        onClick={() => setOpen(value => !value)}
        className="text-sm font-medium underline underline-offset-4"
      >
        {t('demo_visits_title', { defaultValue: 'Demo visits, last 30 days' })}
      </button>
      {open && (
        <div id="admin-demo-visits" className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-theme-text-secondary">
            {t('demo_visits_notice', {
              defaultValue: 'Places come from the visitor\'s IP address and are approximate. Only the first part of the IP is kept, for 90 days.',
            })}
          </p>
          {visits.isError ? (
            <p role="alert">
              {t('demo_visits_error', { defaultValue: 'Demo visits could not be loaded.' })}{' '}
              <button type="button" className="underline" onClick={() => void visits.refetch()}>{t('users_demo_retry')}</button>
            </p>
          ) : visits.isLoading || !visits.data ? (
            <p role="status">{t('users_demo_loading')}</p>
          ) : visits.data.visits.length === 0 ? (
            <p>{t('demo_visits_none', { defaultValue: 'Nobody opened the demo in the last 30 days.' })}</p>
          ) : (
            <>
              <p className="tabular-nums">
                {visits.data.byCountry
                  .map(row => `${countryName(row.countryCode, unknown)}: ${row.visits}`)
                  .join(', ')}
              </p>
              <table className="w-full text-left">
                <thead className="text-slate-600 dark:text-theme-text-muted">
                  <tr>
                    <th className="py-1 pe-3 font-medium">{t('demo_visits_when', { defaultValue: 'When' })}</th>
                    <th className="py-1 pe-3 font-medium">{t('demo_visits_place', { defaultValue: 'Place' })}</th>
                    <th className="py-1 pe-3 font-medium">{t('demo_visits_ip', { defaultValue: 'IP (shortened)' })}</th>
                    <th className="py-1 font-medium">{t('demo_visits_device', { defaultValue: 'Device' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.data.visits.map(visit => (
                    <tr key={`${visit.createdAt}-${visit.ipPrefix}`} className="border-t border-slate-900/[0.08] dark:border-white/[0.08]">
                      <td className="py-1 pe-3 tabular-nums">{new Date(visit.createdAt).toLocaleString(appLocale())}</td>
                      <td className="py-1 pe-3">
                        {[visit.city, visit.region, countryName(visit.countryCode, unknown)].filter(Boolean).join(', ')}
                      </td>
                      <td className="py-1 pe-3 tabular-nums">{visit.ipPrefix ?? '—'}</td>
                      <td className="py-1">{visit.device ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visits.data.visits.some(visit => visit.locationSource === 'geoip') && (
                <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                  <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline">IP Geolocation by DB-IP</a>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
