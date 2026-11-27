import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FarmerServices } from '../pages/landing/sections/FarmerServices';

const liveResponse = {
  success: true,
  data: {
    country: 'Kenya',
    currency: 'USD',
    period: '2025',
    dataStatus: 'live',
    attribution: 'FAOSTAT Producer Prices (CC BY 4.0)',
    prices: [
      { crop: 'Maize (corn)', cropCode: '0112', usdPerTonne: 400, usdPerKg: 0.4, usdPerBag90kg: 36, yoyPct: 5.3 },
      { crop: 'Beans (Dry)', cropCode: '01591', usdPerTonne: 900, usdPerKg: 0.9, usdPerBag90kg: 81, yoyPct: -2.1 },
      { crop: 'Sorghum', cropCode: '0115', usdPerTonne: 320, usdPerKg: 0.32, usdPerBag90kg: 28.8, yoyPct: null },
    ],
  },
};

const renderSection = () =>
  render(
    <MemoryRouter>
      <FarmerServices />
    </MemoryRouter>
  );

describe('landing market price card', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the published year, USD bag prices and the FAOSTAT attribution', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => liveResponse,
    });

    renderSection();

    await screen.findByText(/Producer price · 2025/);
    const card = screen.getByTestId('market-price-card');

    expect(within(card).getByText('$36.00')).toBeTruthy();
    expect(within(card).getByText('+5.3% vs 2024')).toBeTruthy();
    expect(within(card).getByText('-2.1% vs 2024')).toBeTruthy();
    // No previous year's figure: fall back to the unit rather than a fake trend.
    expect(within(card).getByText('per 90 kg bag')).toBeTruthy();

    const attribution = within(card).getByRole('link');
    expect(attribution.getAttribute('href')).toContain('faostat');
    expect(attribution.getAttribute('rel')).toBe('noopener noreferrer');
    expect(attribution.textContent).toContain('FAOSTAT');
  });

  it('keeps the labelled sample preview when the feed fails, and shows no dollar amount', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    renderSection();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(within(screen.getByTestId('market-price-card')).getByText('Illustrative demo data')).toBeTruthy());

    const card = screen.getByTestId('market-price-card');
    // The critical guarantee: sample numbers are never dressed up as real quotes.
    expect(within(card).queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole('link', { name: /FAOSTAT/i })).toBeNull();
  });

  it('ignores an "unavailable" payload instead of showing an empty price card', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { ...liveResponse.data, prices: [], period: null, dataStatus: 'unavailable' },
      }),
    });

    renderSection();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(within(screen.getByTestId('market-price-card')).getByText('Illustrative demo data')).toBeTruthy();
  });
});
