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

  it('lets farmers check their own crops, as a paid service like for officers', () => {
    const diagnosis = getNavItems().find(item => item.id === 'disease_diagnosis')!;
    expect(diagnosis.roles).toEqual(expect.arrayContaining(['farmer', 'extension_officer', 'admin']));
    expect(diagnosis.roles).not.toContain('regional_manager');
    expect(diagnosis.requiresPro).toBe(true);
  });

  it('starts a farmer on their own dashboard, never the officer one', () => {
    expect(menuFor('farmer')[0]).toBe('farmer_dashboard');
    expect(menuFor('farmer')).not.toContain('dashboard');
  });

  it("gives farmers a chat with their own officer, on the same plan as officers' Farmer Chat", () => {
    const items = getNavItems();
    const officerChat = items.find(item => item.id === 'officerchat')!;
    const farmerChat = items.find(item => item.id === 'farmerchat')!;

    expect(officerChat.roles).toEqual(['farmer']);
    expect(officerChat.requiresPro).toBe(true);
    expect(officerChat.requiresPro).toBe(farmerChat.requiresPro);
    // The officers' page (every farmer's thread, copilot, field data) stays theirs.
    expect(menuFor('farmer')).not.toContain('farmerchat');
    expect(menuFor('extension_officer')).not.toContain('officerchat');
  });
});

