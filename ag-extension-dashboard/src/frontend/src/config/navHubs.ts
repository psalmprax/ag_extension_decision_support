import type { NavItem } from './navItems';

/**
 * Menu items that open as tabs of one page (QA v1 #15/#30: the sidebar had
 * 25 items). The menu shows one entry per hub, opening its first page the
 * user may see; the pages show the hub's tabs at the top.
 */
export const NAV_HUBS = [
  {
    id: 'system',
    label: 'System',
    labelKey: 'nav_hub_system',
    itemIds: ['system_health', 'telemetry', 'agents', 'memory', 'mcp_tools'],
  },
  {
    id: 'outreach',
    label: 'Outreach',
    labelKey: 'nav_hub_outreach',
    itemIds: ['sms', 'email_workflows'],
  },
] as const;

type Hub = (typeof NAV_HUBS)[number];

export function hubOf(tabId: string): Hub | undefined {
  return NAV_HUBS.find(hub => (hub.itemIds as readonly string[]).includes(tabId));
}

/** The hub's pages this user can open, in hub order. */
export function hubMembers(hub: Hub, navItems: NavItem[]): NavItem[] {
  return hub.itemIds
    .map(id => navItems.find(item => item.id === id))
    .filter((item): item is NavItem => Boolean(item));
}

/**
 * The menu with each hub collapsed to one entry: its first page the user can
 * open, labelled with the hub's name. A hub with one page stays that page.
 */
export function collapseHubs(navItems: NavItem[]): NavItem[] {
  const shown = new Set<string>();
  return navItems.flatMap(item => {
    const hub = hubOf(item.id);
    if (!hub) return [item];
    const members = hubMembers(hub, navItems);
    if (members.length < 2) return [item];
    if (shown.has(hub.id)) return [];
    shown.add(hub.id);
    return [{ ...members[0], label: hub.label, labelKey: hub.labelKey }];
  });
}

/** True when the menu entry for `item` covers the open tab (directly or through its hub). */
export function menuItemIsActive(item: NavItem, activeTab: string, navItems: NavItem[]): boolean {
  if (item.id === activeTab) return true;
  const hub = hubOf(item.id);
  return Boolean(hub && hubMembers(hub, navItems).length > 1 && (hub.itemIds as readonly string[]).includes(activeTab));
}
