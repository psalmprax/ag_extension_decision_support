import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getNavItems } from '@/config/navItems';
import { isMenuItemLocked } from '@/lib/planAccess';
import { KnowledgeAskLock } from '@/components/KnowledgeBase/KnowledgeAskLock';
import { DemoVisitsPanel } from '@/components/DemoVisitsPanel';

const get = vi.fn();
vi.mock('@/api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) } }));
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, options?: string | ({ defaultValue?: string } & Record<string, unknown>)) => {
      const text = typeof options === 'string' ? options : options?.defaultValue ?? key;
      return typeof options === 'object' ? text.replace(/\{(\w+)\}/g, (_m, name) => String(options[name])) : text;
    },
  }),
}));

const item = (id: string) => getNavItems().find(entry => entry.id === id)!;
const free = { role: 'extension_officer', planName: 'Free', isFree: true };

describe('access while billing is off', () => {
  it('locks Crops & fields and Reports in the menu for Free accounts, unless granted', () => {
    expect(isMenuItemLocked(free, item('fields'))).toBe(true);
    expect(isMenuItemLocked(free, item('reports'))).toBe(true);
    expect(isMenuItemLocked({ ...free, serviceAccess: ['reports'] }, item('reports'))).toBe(false);
    expect(isMenuItemLocked(free, item('knowledge'))).toBe(false); // browsing stays open
  });

  it('lists Billing for administrators and paying accounts only, so they can manage or cancel', () => {
    const billing = item('billing');
    expect(billing.hiddenFor?.(free)).toBe(true);
    expect(billing.hiddenFor?.({ role: 'farmer', planName: 'Pro', isFree: false })).toBe(false);
    expect(billing.hiddenFor?.({ role: 'admin', planName: null })).toBe(false);
  });

  it('says asking the AI is locked, that the guides stay readable, and how to ask for access', () => {
    render(<KnowledgeAskLock />);
    expect(screen.getByText('Asking the AI is not included in this account')).toBeInTheDocument();
    expect(screen.getByText(/document library/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask us for access' }).getAttribute('href')).toContain('mailto:info@gpfed.com');
  });

  it('shows admins recent demo visits with an approximate place and a shortened IP', async () => {
    get.mockResolvedValueOnce({
      data: {
        success: true,
        days: 30,
        visits: [{ createdAt: '2026-11-27T10:00:00Z', countryCode: 'NG', region: 'Lagos', city: 'Ikeja', ipPrefix: '102.89.33.x', device: 'Chrome on Android', locationSource: 'geoip' }],
        byCountry: [{ countryCode: 'NG', visits: 1 }],
      },
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DemoVisitsPanel />
      </QueryClientProvider>,
    );
    expect(get).not.toHaveBeenCalled(); // loads only when opened
    fireEvent.click(screen.getByRole('button', { name: 'Demo visits, last 30 days' }));
    expect(await screen.findByText('Ikeja, Lagos, Nigeria')).toBeInTheDocument();
    expect(screen.getByText('102.89.33.x')).toBeInTheDocument();
    expect(screen.getByText('Nigeria: 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IP Geolocation by DB-IP' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/demo-visits', { params: { days: 30 } });
  });
});
