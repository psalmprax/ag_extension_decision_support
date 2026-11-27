import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { FarmerListResponse } from '@ag-extension/shared/api';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { useDemoMode } from '@/demo/useDemoMode';
import type { DirectoryUser } from './users/types';
import { DemoVisitsPanel } from './DemoVisitsPanel';

type DemoUser = Pick<DirectoryUser, 'id' | 'firstName' | 'lastName' | 'email'>;

const PAGE_SIZE = 50;

export function AdminDemoRecords() {
  const { t } = useLanguage();
  const user = useAppStore(state => state.user);
  const { isDemo } = useDemoMode();
  const isAdmin = user?.role === 'admin' && !isDemo;
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const enabled = isAdmin && open;
  const users = useQuery({
    queryKey: ['admin-demo-users', user?.id],
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DemoUser[] }>('/users', {
        params: { dataset: 'demo' },
      });
      return response.data.data;
    },
  });
  const farmers = useQuery({
    queryKey: ['admin-demo-farmers', user?.id, offset],
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<FarmerListResponse>('/farmers', {
        params: { dataset: 'demo', limit: PAGE_SIZE, offset },
      });
      return response.data.data.farmers;
    },
  });

  if (!isAdmin) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-theme-bg-secondary p-5 space-y-4 text-slate-900 dark:text-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-demo-records"
        onClick={() => setOpen(value => !value)}
        className="text-sm font-medium underline underline-offset-4"
      >
        {t('users_demo_title')}
      </button>
      <DemoVisitsPanel />
      {open && (
        <div id="admin-demo-records" className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-theme-text-secondary">{t('users_demo_notice')}</p>
          {users.isError || farmers.isError ? (
            <div role="alert" className="space-y-2">
              <p>{t('users_demo_load_error')}</p>
              <button type="button" className="underline" onClick={() => {
                void users.refetch();
                void farmers.refetch();
              }}>{t('users_demo_retry')}</button>
            </div>
          ) : users.isLoading || farmers.isLoading ? (
            <p role="status">{t('users_demo_loading')}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-medium mb-2">{t('users_demo_accounts')}</h2>
                {users.data?.length ? (
                  <ul className="space-y-2 text-sm">
                    {users.data.map(record => (
                      <li key={record.id}>
                        {record.firstName} {record.lastName}
                        <span className="block text-slate-600 dark:text-theme-text-secondary">{record.email}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm">{t('users_demo_empty_accounts')}</p>}
              </div>
              <div>
                <h2 className="text-sm font-medium mb-2">{t('users_demo_farmers')}</h2>
                {farmers.data?.length ? (
                  <ul className="space-y-2 text-sm">
                    {farmers.data.map(record => (
                      <li key={record.id}>
                        {record.firstName} {record.lastName}
                        <span className="block text-slate-600 dark:text-theme-text-secondary">{record.region}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm">{t('users_demo_empty_farmers')}</p>}
                <div className="flex gap-4 mt-4 text-sm">
                  <button type="button" disabled={offset === 0 || farmers.isFetching}
                    className="underline disabled:opacity-50"
                    onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}
                  >{t('users_demo_previous')}</button>
                  <button type="button" disabled={farmers.data?.length !== PAGE_SIZE || farmers.isFetching}
                    className="underline disabled:opacity-50"
                    onClick={() => setOffset(value => value + PAGE_SIZE)}
                  >{t('users_demo_next')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
