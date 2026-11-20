import { describe, expect, it } from 'vitest';
import { dashboardGreeting } from '@/pages/dashboardGreeting';

// Mirrors LanguageContext's interpolation: replaces {key} with the param value.
const t = (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
  const templates: Record<string, string> = {
    dashboard_welcome: 'Welcome back, {name}! Here is your overview.',
    dashboard_overview: 'Dashboard overview',
  };
  let text = templates[key] ?? options?.defaultValue ?? key;
  for (const [k, v] of Object.entries(options ?? {})) if (k !== 'defaultValue') text = text.replace(`{${k}}`, String(v));
  return text;
};

describe('dashboardGreeting', () => {
  it('greets the user by first name', () => {
    expect(dashboardGreeting(t, 'Amina')).toBe('Welcome back, Amina! Here is your overview.');
  });

  it('never shows a raw {name} placeholder when the name is unknown', () => {
    for (const name of [undefined, '', '   ']) {
      const text = dashboardGreeting(t, name);
      expect(text).not.toContain('{name}');
      expect(text).toBe('Dashboard overview');
    }
  });
});
