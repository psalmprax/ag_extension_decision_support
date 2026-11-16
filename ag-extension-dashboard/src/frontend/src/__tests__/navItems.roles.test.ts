import { describe, it, expect } from 'vitest';
import { getNavItems } from '@/config/navItems';

const menuFor = (role: string) => getNavItems().filter(item => item.roles.includes(role as never)).map(item => item.id);

describe('menu per role', () => {
  it('gives regional managers the supervisory pages their API access covers', () => {
    expect(menuFor('regional_manager')).toEqual(
      expect.arrayContaining(['dashboard', 'knowledge', 'portfolio', 'visits', 'reports', 'sms', 'analytics', 'fields', 'worldmonitor'])
    );
    // Not theirs: officer-to-farmer chat, diagnosis (API excludes them), admin tools.
    expect(menuFor('regional_manager')).not.toEqual(expect.arrayContaining(['farmerchat']));
    expect(menuFor('regional_manager')).not.toContain('disease_diagnosis');
    expect(menuFor('regional_manager')).not.toContain('user_management');
  });

  it('starts a farmer on their own dashboard, never the officer one', () => {
    expect(menuFor('farmer')[0]).toBe('farmer_dashboard');
    expect(menuFor('farmer')).not.toContain('dashboard');
  });
});
