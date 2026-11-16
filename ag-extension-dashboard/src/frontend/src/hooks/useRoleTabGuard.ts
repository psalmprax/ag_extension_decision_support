import { useEffect } from 'react';

/** Tabs opened from inside a page rather than the menu (officer and admin flows). */
const FLOW_TABS = new Set(['register_farmer', 'visit_synthesis']);

/**
 * Keeps the user on a tab their role can open. Everyone lands on /dashboard
 * after sign-in, which is the officer dashboard: a farmer saw officer widgets
 * whose data the API then refused, and a role without a dashboard saw a page
 * it has no menu entry for. Such a tab is replaced by the role's first menu
 * item (the farmer's own dashboard for farmers).
 */
export function useRoleTabGuard(
  activeTab: string,
  setActiveTab: (tab: string) => void,
  menuTabIds: string[],
  signedIn: boolean
) {
  // A string key keeps the effect from re-running on every render's new array.
  const menuKey = menuTabIds.join('|');
  useEffect(() => {
    const ids = menuKey ? menuKey.split('|') : [];
    if (!signedIn || ids.length === 0) return;
    if (ids.includes(activeTab) || FLOW_TABS.has(activeTab)) return;
    setActiveTab(ids[0]);
  }, [activeTab, setActiveTab, menuKey, signedIn]);
}
