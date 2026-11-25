import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppSearch } from '@/hooks/useAppSearch';
import { searchKnowledgeHits, type KnowledgeSearchHit } from '@/api/knowledgeService';

vi.mock('@/api/knowledgeService', () => ({ searchKnowledgeHits: vi.fn() }));
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: false }), DEMO_FARMERS: [], DEMO_VISITS: [], DEMO_REPORTS: [] }));

const mockSearch = vi.mocked(searchKnowledgeHits);

/** Searching with a term: title and category inside metadata. */
const METADATA_ONLY: KnowledgeSearchHit = { id: 'a1', content: 'Scout weekly.', metadata: { title: 'Fall armyworm scouting', category: 'Pests' }, score: 0.9 };
/** Listing: an article row with its title at the top level. */
const ARTICLE_ROW: KnowledgeSearchHit = { id: 'a2', title: 'Maize spacing', category: 'Agronomy', content: 'Rows 75 cm apart.' };
/** A hit with no title anywhere. */
const UNTITLED: KnowledgeSearchHit = { id: 'a3', content: 'No title at all.', metadata: {}, score: 0.5 };

async function searchFor(term: string) {
  const { result } = renderHook(() => useAppSearch([], [], [], []));
  act(() => result.current.handleGlobalSearch(term));
  return result;
}

describe('app search: knowledge-base results', () => {
  beforeEach(() => mockSearch.mockReset());

  it('takes the title and category from metadata, where searching with a term puts them', async () => {
    mockSearch.mockResolvedValue({ success: true, data: { articles: [METADATA_ONLY, ARTICLE_ROW] } });

    const result = await searchFor('armyworm');

    await waitFor(() => expect(result.current.globalSearchResults).toHaveLength(1));
    expect(result.current.globalSearchResults[0]).toEqual({
      type: 'Knowledge',
      items: [
        { id: 'a1', label: 'Fall armyworm scouting', sublabel: 'Pests' },
        { id: 'a2', label: 'Maize spacing', sublabel: 'Agronomy' },
      ],
    });
  });

  it('leaves out a hit without a title (clicking one used to put undefined in the search box and crash the page)', async () => {
    mockSearch.mockResolvedValue({ success: true, data: { articles: [UNTITLED, METADATA_ONLY] } });

    const result = await searchFor('armyworm');

    await waitFor(() => expect(result.current.globalSearchResults).toHaveLength(1));
    expect(result.current.globalSearchResults[0]!.items.map(item => item.id)).toEqual(['a1']);
  });
});
