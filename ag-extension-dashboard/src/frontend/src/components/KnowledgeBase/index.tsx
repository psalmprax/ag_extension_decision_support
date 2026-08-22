import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lightbulb, Lock, Zap, ArrowRight } from 'lucide-react';
import {
  askAI,
  fetchKnowledgeHistory,
  fetchKnowledgeStats,
  fetchKnowledgeQuota,
  KnowledgeQuotaData,
  Attachment,
  Citation,
  KnowledgeEvidenceStatus,
} from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { KnowledgeStats } from './KnowledgeStats';
import { KnowledgeSidebar } from './KnowledgeSidebar';
import { SearchBar } from './SearchBar';
import { AIResult } from './AIResult';
import type { VisualsData } from './types';

interface ContextItem {
  content: string;
  source?: string;
  score?: number;
  metadata?: {
    title?: string;
    sourceUrl?: string;
    crop?: string;
    category?: string;
  };
}

interface Result {
  answer: string;
  contextUsed: ContextItem[];
  cached?: boolean;
  query?: string;
  timestamp?: string;
  visuals?: VisualsData;
  audio?: string;
  citations?: Citation[];
  evidenceStatus?: KnowledgeEvidenceStatus;
  dailyRemaining?: number;
}

const KnowledgeQuotaBanner: React.FC<{
  quota: KnowledgeQuotaData;
  onUpgrade: () => void;
}> = ({ quota, onUpgrade }) => {
  const isAvailable = quota.remaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isAvailable
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200'
          : 'bg-red-500/10 border-red-500/25 text-red-900 dark:text-red-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isAvailable ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'
          }`}
        >
          {isAvailable ? <Zap className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">
            {isAvailable ? 'Free Plan Quota' : 'Daily Quota Limit Reached'}
          </div>
          <div className="text-xs font-medium opacity-85">
            {isAvailable
              ? `${quota.remaining} of 3 free AI queries remaining today`
              : 'You have used all 3 free daily queries. Upgrade to Pro for unlimited AI agronomic answers.'}
          </div>
        </div>
      </div>

      <button
        onClick={onUpgrade}
        className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all shadow flex items-center gap-1.5 shrink-0"
      >
        <span>Upgrade to Pro</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

const KnowledgeSuggestions: React.FC<{
  onSelect: (q: string) => void;
}> = ({ onSelect }) => {
  const suggestions = [
    'How to manage fall armyworm?',
    'Best time for maize harvesting?',
    'Impact of soil pH on yield?',
    'Intercropping with beans',
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onSelect(suggestion)}
          className="p-6 bg-theme-bg-card border border-gray-100 dark:border-gray-700 hover:border-primary-500 transition-all text-left flex items-start gap-4 group cursor-pointer"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          <div className="p-2 bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-500 group-hover:text-white transition-colors">
            <Lightbulb className="w-5 h-5" />
          </div>
          <span className="font-bold text-gray-700 dark:text-gray-300">{suggestion}</span>
        </button>
      ))}
    </div>
  );
};

const KnowledgeHeader: React.FC<{ headingClass: string; subtitle: string }> = ({
  headingClass,
  subtitle,
}) => (
  <div className="mb-12 text-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-xs font-black uppercase tracking-widest mb-6"
    >
      <Sparkles className="w-3 h-3" />
      ALFA reasoning engine active
    </motion.div>
    <h1 className={`text-4xl font-black mb-4 tracking-tight ${headingClass}`}>Knowledge Base</h1>
    <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-2xl mx-auto">
      {subtitle}
    </p>
  </div>
);

export const KnowledgeBase: React.FC = () => {
  const { t } = useLanguage();
  const { addNotification, setActiveTab } = useAppStore();
  const { headingClass } = useThemeClasses();

  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [quota, setQuota] = useState<KnowledgeQuotaData | null>(null);
  const [history, setHistory] = useState<
    {
      id: string;
      query?: string;
      queryText?: string;
      crop?: string;
      category?: string;
      timestamp?: string;
      createdAt?: string;
    }[]
  >([]);
  const [stats, setStats] = useState<{
    crops?: { name: string; count: number }[];
    categories?: { name: string; count: number }[];
    totalQueries?: number;
    cachedQueries?: number;
  } | null>(null);

  const fetchQuotaData = async () => {
    try {
      const res = await fetchKnowledgeQuota();
      if (res.success) setQuota(res.data);
    } catch {
      // ignore
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await fetchKnowledgeHistory();
      if (data.success) setHistory(data.data);
    } catch {
      // ignore
    }
  };

  const fetchStats = async () => {
    try {
      const data = await fetchKnowledgeStats();
      if (data.success) setStats(data.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchStats();
    fetchQuotaData();
  }, []);

  const performAISearch = async (queryText: string) => {
    setIsAsking(true);
    setLastResult(null);

    try {
      const res = await askAI(queryText, attachments);
      if (!res.success) return;

      setLastResult({
        ...res.data,
        query: queryText || 'Multimodal Search',
        timestamp: new Date().toISOString(),
      });
      setAttachments([]);
      fetchHistory();
      fetchQuotaData();

      if (res.data.cached) {
        addNotification({
          type: 'info',
          message: 'Result retrieved from semantic cache (Cost optimized)',
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; limitReached?: boolean } } };
      if (err.response?.data?.limitReached) {
        setQuota(prev => (prev ? { ...prev, remaining: 0, allowed: false } : null));
      }
      addNotification({
        type: 'error',
        message: err.response?.data?.error || 'Knowledge search failed',
      });
    } finally {
      setIsAsking(false);
    }
  };

  const handleSearch = (queryToSearch?: string) => {
    const queryText = queryToSearch || searchQuery;
    if (!queryText.trim() && attachments.length === 0) return;

    if (quota?.isFree && quota.remaining <= 0) {
      addNotification({
        type: 'warning',
        message:
          'Daily Free limit of 3 knowledge base queries reached. Upgrade to Pro for unlimited searches.',
      });
      return;
    }

    performAISearch(queryText);
  };

  const handleSelectQuery = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  return (
    <div className="flex h-[calc(100dvh-130px)] md:h-[calc(100vh-64px)] overflow-hidden bg-theme-bg/50 backdrop-blur-sm rounded-2xl">
      <KnowledgeSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        history={history}
        onSelect={h => handleSelectQuery(h.queryText || h.query || '')}
      />

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto">
          <KnowledgeHeader headingClass={headingClass} subtitle={t('knowledge_subtitle')} />

          {quota?.isFree && (
            <KnowledgeQuotaBanner quota={quota} onUpgrade={() => setActiveTab('billing')} />
          )}

          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            attachments={attachments}
            setAttachments={setAttachments}
            isAsking={isAsking}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            showStats={showStats}
            setShowStats={setShowStats}
            onSearch={() => handleSearch()}
          />

          <AnimatePresence mode="wait">
            {showStats ? (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {stats && <KnowledgeStats data={stats} />}
              </motion.div>
            ) : lastResult ? (
              <AIResult
                result={
                  lastResult as {
                    answer: string;
                    contextUsed: ContextItem[];
                    cached?: boolean;
                    query?: string;
                    timestamp?: string;
                    visuals?: VisualsData;
                    audio?: string;
                    citations?: Citation[];
                    evidenceStatus?: KnowledgeEvidenceStatus;
                  }
                }
              />
            ) : (
              <KnowledgeSuggestions onSelect={handleSelectQuery} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
