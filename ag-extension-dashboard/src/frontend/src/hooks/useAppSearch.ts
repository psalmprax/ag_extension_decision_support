import { useState } from 'react';
import { searchKnowledge, KnowledgeArticle } from '@/api/knowledgeService';
import { Farmer, Visit, Report } from '../types/dashboard';

interface SearchResult {
    type: string;
    items: {
        id: string;
        label: string;
        sublabel?: string;
    }[];
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

    const getFarmerResults = (query: string): SearchResult | null => {
        const matchedFarmers = (farmers || []).filter((f: Farmer) =>
            `${f.firstName} ${f.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
            (f.region || '').toLowerCase().includes(query.toLowerCase()) ||
            (f.phone || '').includes(query)
        ).slice(0, 5);
        
        if (matchedFarmers.length > 0) {
            return {
                type: 'Farmers',
                items: matchedFarmers.map((f: Farmer) => ({
                    id: f.id,
                    label: `${f.firstName} ${f.lastName}`,
                    sublabel: f.region || f.village || f.district || '',
                }))
            };
        }
        return null;
    };

    const getVisitResults = (query: string): SearchResult | null => {
        const matchedVisits = (visits || []).filter((v: Visit) =>
            v.farmer_name?.toLowerCase().includes(query.toLowerCase()) ||
            v.visit_type?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);
        
        if (matchedVisits.length > 0) {
            return {
                type: 'Visits',
                items: matchedVisits.map((v: Visit) => ({
                    id: v.id,
                    label: `${v.farmer_name} — ${v.visit_type}`,
                    sublabel: new Date(v.scheduled_at).toLocaleDateString(),
                }))
            };
        }
        return null;
    };

    const getReportResults = (query: string): SearchResult | null => {
        const matchedReports = (reports || []).filter((r: Report) => 
            r.title?.toLowerCase().includes(query.toLowerCase()) ||
            r.type?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);
        
        if (matchedReports.length > 0) {
            return {
                type: 'Reports',
                items: matchedReports.map((r: Report) => ({
                    id: r.id,
                    label: r.title,
                    sublabel: `Generated ${new Date(r.generatedAt).toLocaleDateString()}`
                }))
            };
        }
        return null;
    };

    const getTransactionResults = (query: string): SearchResult | null => {
        const matchedTransactions = (transactions || []).filter((tx: Record<string, unknown>) =>
            String(tx.transactionId || '').toLowerCase().includes(query.toLowerCase()) ||
            String(tx.status || '').toLowerCase().includes(query.toLowerCase()) ||
            String(tx.method || '').toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);

        if (matchedTransactions.length > 0) {
            return {
                type: 'Billing',
                items: matchedTransactions.map((tx: Record<string, unknown>) => ({
                    id: String(tx.id || ''),
                    label: `TX: ${tx.transactionId}`,
                    sublabel: `${tx.amount} ${tx.currency} • ${tx.status}`
                }))
            };
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
        
        try {
            const farmerResults = getFarmerResults(query);
            if (farmerResults) results.push(farmerResults);

            try {
                const knowledgeResults = await searchKnowledge(query);
                if (knowledgeResults.success && knowledgeResults.data?.articles?.length > 0) {
                    results.push({
                        type: 'Knowledge',
                        items: knowledgeResults.data.articles.slice(0, 3).map((a: KnowledgeArticle) => ({
                            id: a.id,
                            label: a.title,
                            sublabel: a.category || '',
                        }))
                    });
                }
            } catch { /* knowledge search optional */ }

            const visitResults = getVisitResults(query);
            if (visitResults) results.push(visitResults);

            const reportResults = getReportResults(query);
            if (reportResults) results.push(reportResults);

            const txResults = getTransactionResults(query);
            if (txResults) results.push(txResults);
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
        handleGlobalSearch
    };
};
