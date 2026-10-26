import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from '../GlobalSearch';

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({
    t: (_key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : options?.defaultValue ?? _key,
  }),
}));

const renderSearch = (overrides: Partial<ComponentProps<typeof GlobalSearch>> = {}) => {
  const props: ComponentProps<typeof GlobalSearch> = {
    searchQuery: 'orchard',
    setSearchQuery: vi.fn(),
    showGlobalSearch: true,
    setShowGlobalSearch: vi.fn(),
    isGlobalSearching: false,
    globalSearchResults: [],
    handleGlobalSearch: vi.fn(),
    setWeatherLocation: vi.fn(),
    addNotification: vi.fn(),
    farmers: [],
    handleOpenFarmerDetail: vi.fn(),
    setActiveTab: vi.fn(),
    ...overrides,
  };

  return render(<GlobalSearch {...props} />);
};

describe('GlobalSearch', () => {
  it('shows a loading state before remote results are available', () => {
    renderSearch({ isGlobalSearching: true });

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Searching...');
  });

  it('explains when the search has no results', () => {
    renderSearch();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('No results found');
  });
});
