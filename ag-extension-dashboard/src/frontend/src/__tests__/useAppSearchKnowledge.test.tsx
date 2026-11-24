import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppSearch } from '@/hooks/useAppSearch';
import { searchKnowledge } from '@/api/knowledgeService';

vi.mock('@/api/knowledgeService', () => ({ searchKnowledge: vi.fn() }));
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: false }), DEMO_FARMERS: [], DEMO_VISITS: [], DEMO_REPORTS: [] }));

const mockSearch = searchKnowledge as unknown as ReturnType<typeof vi.fn>;

describe('app search: knowledge-base results', () => {
  beforeEach(() => mockSearch.mockReset());

  it('takes the title and category from metadata, where searching with a term puts them', async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: {
        articles: [
          { id: 'a1', content: 'Scout weekly.', metadata: { title: 'Fall armyworm scouting', category: 'Pests' }, score: 0.9 },
          { id: 'a2', title: 'Maize spacing', category: 'Agronomy', content: 'Rows 75 cm apart.' },
          { id: 'a3', content: 'No title at all.', metadata: {}, score: 0.5 },
        ],
      },
    });
    const { result } = renderHook(() => useAppSearch([], [], [], []));

    act(() => result.current.handleGlobalSearch('armyworm'));

    await waitFor(() => expect(result.current.globalSearchResults).toHaveLength(1));
    // A result without a title is left out: clicking it used to put undefined in the search box and crash the page.
    expect(result.current.globalSearchResults[0]).toEqual({
      type: 'Knowledge',
      items: [
        { id: 'a1', label: 'Fall armyworm scouting', sublabel: 'Pests' },
        { id: 'a2', label: 'Maize spacing', sublabel: 'Agronomy' },
      ],
    });
  });
});
