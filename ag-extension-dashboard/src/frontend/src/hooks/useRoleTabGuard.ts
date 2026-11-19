import { useEffect } from 'react';

/**
 * Tabs opened from inside a page rather than the menu, keyed to the menu page
 * they belong to: a role may open the flow only if it can open that page (a
 * farmer has no Farmers page, so cannot reach farmer registration).
 */
const FLOW_TABS: Record<string, string> = {
  register_farmer: 'portfolio',
  visit_synthesis: 'visits',
};

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
    const flowPage = FLOW_TABS[activeTab];
    if (ids.includes(activeTab) || (flowPage !== undefined && ids.includes(flowPage))) return;
    setActiveTab(ids[0]);
  }, [activeTab, setActiveTab, menuKey, signedIn]);
}
