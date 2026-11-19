import { describe, expect, it } from 'vitest';
import { getNavItems } from '@/config/navItems';
import { collapseHubs, menuItemIsActive } from '@/config/navHubs';

const forRole = (role: string) => getNavItems().filter(item => item.roles.includes(role));

describe('menu hubs', () => {
  it('shows an admin one System entry and one Outreach entry instead of seven pages', () => {
    const items = forRole('admin');
    const menu = collapseHubs(items);
    const ids = menu.map(item => item.id);

    expect(menu.length).toBe(items.length - 5);
    expect(menu.filter(item => item.label === 'System')).toHaveLength(1);
    expect(menu.filter(item => item.label === 'Outreach')).toHaveLength(1);
    for (const merged of ['telemetry', 'agents', 'memory', 'mcp_tools', 'email_workflows']) {
      expect(ids).not.toContain(merged);
    }
  });

  it('keeps the System entry highlighted on any of its tabs', () => {
    const items = forRole('admin');
    const system = collapseHubs(items).find(item => item.label === 'System')!;
    expect(menuItemIsActive(system, 'mcp_tools', items)).toBe(true);
    expect(menuItemIsActive(system, 'visits', items)).toBe(false);
  });

  it('leaves a hub with a single page for this role as that page', () => {
    const items = forRole('extension_officer');
    const menu = collapseHubs(items);
    const sms = menu.find(item => item.id === 'sms');
    if (sms) expect(sms.label).not.toBe('Outreach');
  });
});
