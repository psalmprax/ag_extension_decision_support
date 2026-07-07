import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers.
// Derived from vitest's expect.extend signature to stay type-correct without
// depending on internal vitest type names.
expect.extend(matchers as Parameters<typeof expect.extend>[0]);

import defaultTranslations from '../../public/locales/en.json';
import swTranslations from '../../public/locales/sw.json';

const localeData: Record<string, Record<string, string>> = {
  en: { ...defaultTranslations, test_key: 'Test English' },
  sw: { ...swTranslations, test_key: 'Jaribio la Kiswahili' },
};

vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string) => {
    const match = url.match(/\/locales\/(\w+)\.json/);
    if (match) {
      const lang = match[1];
      const data = localeData[lang] || localeData['en'];
      return {
        ok: true,
        json: async () => data,
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  })
);

// Reset any states between tests
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Global mocks for API services to prevent real network calls and fix caching/hoisting order
vi.mock('@/api/farmerService', () => ({
  updateFarmer: vi.fn().mockResolvedValue({ success: true }),
  updateFarmers: vi.fn().mockResolvedValue({ success: true }),
  removeFarmer: vi.fn().mockResolvedValue({ success: true }),
  removeFarmers: vi.fn().mockResolvedValue({ success: true }),
  deleteFarmer: vi.fn().mockResolvedValue({ success: true }),
  deleteFarmers: vi.fn().mockResolvedValue({ success: true }),
  fetchFarmers: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/api/visitService', () => ({
  addVisit: vi.fn().mockResolvedValue({ success: true }),
  updateVisit: vi.fn().mockResolvedValue({ success: true }),
  fetchVisits: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createVisit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));
