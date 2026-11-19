import React from 'react';
import type { NavItem } from '@/config/navItems';
import { hubMembers, hubOf } from '@/config/navHubs';
import { useLanguage } from '@/lib/LanguageContext';

/** Tabs across the top of a page that belongs to a hub (System, Outreach). */
export const HubTabs: React.FC<{ activeTab: string; navItems: NavItem[]; setActiveTab: (tab: string) => void }> = ({
  activeTab,
  navItems,
  setActiveTab,
}) => {
  const { t } = useLanguage();
  const hub = hubOf(activeTab);
  const members = hub ? hubMembers(hub, navItems) : [];
  if (!hub || members.length < 2) return null;
  return (
    <div role="tablist" aria-label={t(hub.labelKey, hub.label)} className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 dark:border-white/10">
      {members.map(item => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeTab}
          onClick={() => setActiveTab(item.id)}
          className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
            item.id === activeTab
              ? 'border-emerald-600 text-slate-900 dark:text-white font-medium'
              : 'border-transparent text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t(item.labelKey || `nav_${item.id}`, item.label)}
        </button>
      ))}
    </div>
  );
};
