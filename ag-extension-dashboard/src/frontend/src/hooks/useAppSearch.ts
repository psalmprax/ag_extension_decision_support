import { useState } from 'react';
import { searchKnowledge, KnowledgeArticle } from '@/api/knowledgeService';
import { Farmer, Visit, Report } from '../types/dashboard';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_FARMERS } from '@/data/demoFarmers';

interface SearchResult {
  type: string;
  items: {
    id: string;
    label: string;
    sublabel?: string;
  }[];
}

interface VisitShape {
  id: string;
  farmer_name?: string;
  scheduled_at?: string;
  visit_type?: string;
  farmerId?: string;
  farmerName?: string;
  scheduledDate?: string;
  status?: string;
}

export const useAppSearch = (
  farmers: Farmer[],
  visits: Visit[],
  reports: Report[],
  transactions: Array<Record<string, unknown>>
) => {
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
  const isDemo = useAppStore(s => s.isDemo);

  // transactions intentionally not used in demo; suppress unused-arg lint
  void transactions;

  // Demo fallback data so search returns useful results without live API.
  // Note: types/dashboard uses snake_case (farmer_name, scheduled_at, visit_type).
  const DEMO_VISITS: Visit[] = [
    {
      id: 'demo-v1',
      farmer_id: 'demo-1',
      farmer_name: 'Demo Farmer',
      scheduled_at: new Date().toISOString(),
      status: 'pending',
    } as unknown as Visit,
  ];
  const DEMO_REPORTS: Report[] = [
    { id: 'demo-r1', title: 'Demo Region Overview' } as unknown as Report,
  ];

  const getFarmerResultsLocal = (query: string, source: Farmer[]): SearchResult | null => {
    const matchedFarmers = (source || [])
      .filter(
        f =>
          `${f.firstName} ${f.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
          (f.region || '').toLowerCase().includes(query.toLowerCase()) ||
          (f.phone || '').includes(query)
      )
      .slice(0, 5);

    if (matchedFarmers.length > 0) {
      return {
        type: 'Farmers',
        items: matchedFarmers.map(f => ({
          id: f.id,
          label: `${f.firstName} ${f.lastName}`,
          sublabel: f.region || f.village || '',
        })),
      };
    }
    return null;
  };

  const getVisitResultsLocal = (query: string, source: Visit[]): SearchResult | null => {
    const matchedVisits = (source || [])
      .filter((v: VisitShape) => {
        const name = (v.farmer_name ?? v.farmerName ?? '').toLowerCase();
        const type = (v.visit_type ?? '').toLowerCase();
        return name.includes(query.toLowerCase()) || type.includes(query.toLowerCase());
      })
      .slice(0, 3);

    if (matchedVisits.length > 0) {
      return {
        type: 'Visits',
        items: matchedVisits.map((v: VisitShape) => {
          const farmerName = v.farmer_name ?? v.farmerName ?? '';
          const scheduledAt = v.scheduled_at ?? v.scheduledDate ?? '';
          return {
            id: v.id,
            label: `${farmerName} — Visit`,
            sublabel: scheduledAt ? new Date(scheduledAt).toLocaleDateString() : '',
          };
        }),
      };
    }
    return null;
  };

  const getReportResultsLocal = (query: string, source: Report[]): SearchResult | null => {
    const matchedReports = (source || [])
      .filter(
        r =>
          r.title?.toLowerCase().includes(query.toLowerCase()) ||
          r.type?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3);

    if (matchedReports.length > 0) {
      return {
        type: 'Reports',
        items: matchedReports.map(r => ({
          id: r.id,
          label: r.title,
          sublabel: `Generated ${new Date(r.generatedAt).toLocaleDateString()}`,
        })),
      };
    }
    return null;
  };

  const getTransactionResults = (query: string): SearchResult | null => {
    const matchedTransactions = (transactions || [])
      .filter(
        tx =>
          String(tx.transactionId || '').toLowerCase().includes(query.toLowerCase()) ||
          String(tx.status || '').toLowerCase().includes(query.toLowerCase()) ||
          String(tx.method || '').toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3);

    if (matchedTransactions.length > 0) {
      return {
        type: 'Billing',
        items: matchedTransactions.map(tx => ({
          id: String(tx.id || ''),
          label: `TX: ${tx.transactionId}`,
          sublabel: `${tx.amount} ${tx.currency} • ${tx.status}`,
        })),
      };
    }
    return null;
  };

  // Returns a Knowledge SearchResult for the given query, or null.
  // In demo mode we seed a synthetic placeholder so the UI still has
  // something to render; otherwise we hit the live knowledge API and
  // swallow errors (knowledge search is optional).
  const getKnowledgeResults = async (
    query: string,
    isDemoMode: boolean
  ): Promise<SearchResult | null> => {
    if (isDemoMode) {
      return {
        type: 'Knowledge',
        items: [
          {
            id: 'demo-kb',
            label: `${query} (demo result)`,
            sublabel: 'Demo mode — sign up for full results',
          },
        ],
      };
    }
    try {
      const knowledgeResults = await searchKnowledge(query);
      if (knowledgeResults.success && knowledgeResults.data?.articles?.length > 0) {
        return {
          type: 'Knowledge',
          items: knowledgeResults.data.articles
            .slice(0, 3)
            .map((a: KnowledgeArticle) => ({
              id: a.id,
              label: a.title,
              sublabel: a.category || '',
            })),
        };
      }
    } catch {
      /* knowledge search optional */
    }
    return null;
  };

  const handleGlobalSearch = async (query: string) => {
    if (!query.trim()) {
      setGlobalSearchResults([]);
      setShowGlobalSearch(false);
      return;
    }

    setIsGlobalSearching(true);
    setShowGlobalSearch(true);
    const results: SearchResult[] = [];

    // For demo: use local fallback datasets so search works without live API
    const sourceFarmers = isDemo ? DEMO_FARMERS : farmers;
    const sourceVisits = isDemo ? DEMO_VISITS : visits;
    const sourceReports = isDemo ? DEMO_REPORTS : reports;

    try {
      const farmerResults = getFarmerResultsLocal(query, sourceFarmers);
      if (farmerResults) results.push(farmerResults);

      const knowledgeResults = await getKnowledgeResults(query, isDemo);
      if (knowledgeResults) results.push(knowledgeResults);

      const visitResults = getVisitResultsLocal(query, sourceVisits);
      if (visitResults) results.push(visitResults);

      const reportResults = getReportResultsLocal(query, sourceReports);
      if (reportResults) results.push(reportResults);

      if (!isDemo) {
        const txResults = getTransactionResults(query);
        if (txResults) results.push(txResults);
      }
    } finally {
      setGlobalSearchResults(results);
      setIsGlobalSearching(false);
    }
  };

  return {
    showGlobalSearch,
    setShowGlobalSearch,
    isGlobalSearching,
    globalSearchResults,
    handleGlobalSearch,
  };
};
