import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Layers,
  Activity,
  ShieldCheck,
  Download,
  Send,
  RefreshCw,
  Compass,
  ChevronRight,
  BookOpen,
  Search,
  CheckCircle2,
  ExternalLink,
  Filter,
  X,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  askAI,
  fetchKnowledgeStats,
  fetchKnowledgeQuota,
  KnowledgeQuotaData,
  Attachment,
  Citation,
  KnowledgeEvidenceStatus,
  downloadKnowledgePack,
  type AskResponse,
} from '@/api/knowledgeService';
import { useAppStore } from '@/store/useAppStore';
import { KnowledgeStats } from './KnowledgeStats';
import { SearchBar } from './SearchBar';
import { AIResult } from './AIResult';
import type { VisualsData } from './types';
import { AgronomicIntakeCard, isAgronomicQueryAmbiguous } from '../AgronomicIntakeCard';
import { useDemoMode } from '@/demo';

// Interactive Canvas UI Components (canvasui.dev standard)
import { RagKnowledgeGraphCanvas, GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import { SoilNutrientHeatmapCanvas, SoilProbeResult } from '../canvas-ui/SoilNutrientHeatmapCanvas';
import { DiseaseSaliencyCanvas, LesionDetectionZone } from '../canvas-ui/DiseaseSaliencyCanvas';
import { AgroEcosystemCanvasScrubber } from '../canvas-ui/AgroEcosystemCanvasScrubber';

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
  answerMode?: AskResponse['data']['answerMode'];
  contextUsed: ContextItem[];
  cached?: boolean;
  query?: string;
  timestamp?: string;
  visuals?: VisualsData;
  audio?: string;
  citations?: Citation[];
  evidenceStatus?: KnowledgeEvidenceStatus;
  dailyRemaining?: number;
  /** Set when the request itself failed — the panel renders an honest error state. */
  failed?: boolean;
}
import { DOCUMENT_CATALOG, type DocumentArticle } from './catalog';
import { RESEARCH_SCENARIOS, type ResearchScenario, type SpatialCanvasMode } from './scenarios';
import { QuotaChip } from './QuotaChip';
import { useLanguage } from '@/lib/LanguageContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { tabButtonClass } from '@/components/ui/controlStyles';

type KnowledgeTabMode = 'search' | 'graph' | 'workbench' | 'library' | 'telemetry';
// Helper functions extracted to maintain cognitive complexity < 15
const mapCitationCategory = (category?: string): GraphNode['category'] => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('soil')) return 'soil';
  if (cat.includes('clim') || cat.includes('satellite') || cat.includes('nasa')) return 'nasa';
  if (cat.includes('ipm') || cat.includes('pest') || cat.includes('path')) return 'fao';
  return 'rule';
};

const mapCitationToGraphNode = (c: Citation, i: number): GraphNode => ({
  id: c.sourceId || `cit-${i}`,
  label: c.title,
  category: mapCitationCategory(c.category),
  score: c.score,
  snippet: c.excerpt,
});

const matchesArticle = (art: DocumentArticle, category: string, query: string): boolean => {
  if (category !== 'All' && art.category !== category) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    art.title.toLowerCase().includes(q) ||
    art.excerpt.toLowerCase().includes(q) ||
    art.crop.toLowerCase().includes(q) ||
    art.author.toLowerCase().includes(q)
  );
};

// Honest failure state for a failed/exception'd search: no fabricated answer,
// no citations, no verified badge. Retry runs through the panel's Regenerate action.
const SEARCH_FAILURE_ANSWER =
  'The knowledge search failed, so no answer was produced. No cached or fabricated ' +
  'content is substituted in its place — retry the search, or browse the Document ' +
  'Library for source material.';

const buildErrorResult = (queryText: string): Result => ({
  answer: SEARCH_FAILURE_ANSWER,
  contextUsed: [],
  cached: false,
  query: queryText || 'Search failed',
  timestamp: new Date().toISOString(),
  citations: [],
  evidenceStatus: 'no_verified_source',
  failed: true,
  visuals: { kpis: [], charts: [], images: [], videos: [] },
});

const resolveSearchResult = (
  res: AskResponse,
  queryText: string
): Result => {
  // Source counts describe retrieval, not factual or regulatory verification.
  return {
    ...res.data,
    query: queryText || 'Multimodal Search',
    timestamp: new Date().toISOString(),
  };
};

const notifySearchResult = (
  res: AskResponse,
  bypassCache: boolean,
  notify: (opts: { type: 'info' | 'success'; message: string }) => void
): void => {
  // Never claim a fresh synthesis when the assistant answered nothing.
  if (res.data.evidenceStatus === 'no_verified_source') {
    notify({ type: 'info', message: 'General guidance only — no supporting sources were retrieved.' });
    return;
  }
  if (res.data.answerMode === 'extractive') {
    notify({ type: 'info', message: 'AI synthesis unavailable — showing excerpts from retrieved sources.' });
    return;
  }
  if (res.data.cached) {
    notify({
      type: 'info',
      message: 'Result retrieved from your context-scoped answer cache',
    });
  } else if (bypassCache) {
    notify({
      type: 'success',
      message: 'Fresh real-time LLM synthesis generated',
    });
  }
};

const resultHeading = (result: Result): string => {
  if (result.failed) return 'Search Failed — No Answer Generated';
  if (result.answerMode === 'extractive') return 'Source Excerpts — AI Synthesis Unavailable';
  if (result.evidenceStatus !== 'verified_sources') return 'General Guidance — Not Verified';
  return 'Grounded Synthesis Completed';
};

// This legacy feature shell coordinates search, graph, telemetry, and document-library state;
// keep the global cognitive-complexity rule active for all extracted helpers and new components.
export const KnowledgeBase: React.FC = () => {
  const { t } = useLanguage();
  const { user, addNotification, setActiveTab } = useAppStore();
  const { isDemo } = useDemoMode();
  const [activeTabMode, setActiveTabMode] = useState<KnowledgeTabMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [quota, setQuota] = useState<KnowledgeQuotaData | null>(() => {
    if (user?.role === 'admin' || isDemo) {
      return { allowed: true, current: 0, limit: -1, remaining: 999999, isFree: false };
    }
    return null;
  });
  const [activeCanvasMode, setActiveCanvasMode] = useState<SpatialCanvasMode>('phenology');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [retrievalStep, setRetrievalStep] = useState<number>(0);
  const [intakeDismissed, setIntakeDismissed] = useState<boolean>(false);

  // Document Library state
  const [libraryFilterCategory, setLibraryFilterCategory] = useState<string>('All');
  const [librarySearchQuery, setLibrarySearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<DocumentArticle | null>(null);

  const [stats, setStats] = useState<{
    crops?: { name: string; count: number }[];
    categories?: { name: string; count: number }[];
    totalQueries?: number;
    cachedQueries?: number;
  } | null>(null);

  const applyQuotaUpdate = useCallback((dailyRemaining?: number, dailyLimit?: number) => {
    if (typeof dailyRemaining === 'number' && typeof dailyLimit === 'number') {
      setQuota(prev => ({
        allowed: dailyRemaining > 0,
        current: dailyLimit - dailyRemaining,
        limit: dailyLimit,
        remaining: dailyRemaining,
        isFree: prev?.isFree ?? (user?.role !== 'admin'),
      }));
    }
  }, [user?.role]);

  const handleSearchError = useCallback((error: unknown) => {
    const err = error as { response?: { data?: { error?: string; limitReached?: boolean } }; message?: string };
    if (err.response?.data?.limitReached) {
      setQuota(prev => ({
        allowed: false,
        current: prev?.limit ?? 3,
        limit: prev?.limit ?? 3,
        remaining: 0,
        isFree: true,
      }));
    }
    addNotification({
      type: 'error',
      message: err.response?.data?.error || err.message || 'Knowledge search failed',
    });
  }, [addNotification]);

  const finishFailedSearch = useCallback((queryText: string, error: unknown): void => {
    handleSearchError(error);
    setLastResult(buildErrorResult(queryText));
  }, [handleSearchError]);

  const fetchQuotaData = useCallback(async () => {
    try {
      const res = await fetchKnowledgeQuota();
      if (res.success) setQuota(res.data);
    } catch {
      // In demo or guest mode, keep standard quota
      if (user?.role !== 'admin') {
        setQuota(prev => prev ?? (isDemo ? { allowed: true, current: 0, limit: -1, remaining: 999999, isFree: false } : { allowed: true, current: 0, limit: 3, remaining: 3, isFree: true }));
      }
    }
  }, [user?.role, isDemo]);

  const finishSuccessfulSearch = useCallback((
    res: AskResponse,
    queryText: string,
    bypassCache: boolean,
  ): void => {
    setLastResult(resolveSearchResult(res, queryText));
    setAttachments([]);
    applyQuotaUpdate(res.data.dailyRemaining, res.data.dailyLimit);
    fetchQuotaData();
    notifySearchResult(res, bypassCache, addNotification);
  }, [addNotification, applyQuotaUpdate, fetchQuotaData]);

  const fetchStats = async () => {
    try {
      const data = await fetchKnowledgeStats();
      if (data.success) setStats(data.data);
    } catch (error) {
      console.error('Knowledge stats fetch failed:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchQuotaData();
  }, [fetchQuotaData]);

  const performAISearch = async (queryText: string, bypassCache: boolean = false) => {
    setIsAsking(true);
    setRetrievalStep(1);

    const stepInterval = setInterval(() => {
      setRetrievalStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await askAI(queryText, attachments, { bypassCache });
      clearInterval(stepInterval);
      setRetrievalStep(4);

      if (!res.success || typeof res.data?.answer !== 'string' || !res.data.answer.trim()
        || res.data.answerMode === 'unavailable') {
        finishFailedSearch(queryText, new Error(res.error || 'Knowledge search returned no answer'));
        return;
      }

      finishSuccessfulSearch(res, queryText, bypassCache);
    } catch (error: unknown) {
      clearInterval(stepInterval);
      setRetrievalStep(4);
      finishFailedSearch(queryText, error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSearch = (overrideQuery?: string) => {
    const q = overrideQuery || searchQuery;
    if (!q.trim() && attachments.length === 0) return;
    performAISearch(q);
  };

  const handleTriggerScenario = (sc: ResearchScenario) => {
    setSearchQuery(sc.query);
    if ((sc.canvasMode as string) !== 'rag_graph') {
      setActiveCanvasMode(sc.canvasMode as SpatialCanvasMode);
    }
    setActiveTabMode('search');
    toast(`Running live RAG for: ${sc.title}`, { icon: '🔬' });
    performAISearch(sc.query);
  };

  const graphNodes = useMemo<GraphNode[] | undefined>(() => {
    if (!lastResult?.citations?.length) return undefined;
    return lastResult.citations.map(mapCitationToGraphNode);
  }, [lastResult]);

  const filteredArticles = useMemo(() => {
    return DOCUMENT_CATALOG.filter(art =>
      matchesArticle(art, libraryFilterCategory, librarySearchQuery)
    );
  }, [libraryFilterCategory, librarySearchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <PageHeader
        title={t('ui_index_agro_spatial_knowledge_mesh')}
        description={t('ui_index_multi_modal_grounded_semantic_retrie')}
        actions={quota ? <QuotaChip quota={quota} onUpgrade={() => setActiveTab('billing')} /> : undefined}
      >
  <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTabMode('search')}
                  aria-pressed={activeTabMode === 'search'}
                  className={tabButtonClass(activeTabMode === 'search')}
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_index_search_discovery')}</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('graph')}
                  aria-pressed={activeTabMode === 'graph'}
                  className={tabButtonClass(activeTabMode === 'graph')}
                >
                  <Brain className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_index_knowledge_graph')}</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('workbench')}
                  aria-pressed={activeTabMode === 'workbench'}
                  className={tabButtonClass(activeTabMode === 'workbench')}
                >
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_index_spatial_simulators')}</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('library')}
                  aria-pressed={activeTabMode === 'library'}
                  className={tabButtonClass(activeTabMode === 'library')}
                >
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_index_document_library')}</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('telemetry')}
                  aria-pressed={activeTabMode === 'telemetry'}
                  className={tabButtonClass(activeTabMode === 'telemetry')}
                >
                  <Activity className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_index_index_telemetry')}</span>
                </button>
              </div>
      </PageHeader>

      {/* ── TAB 1: Search & AI Discovery ── */}
      {activeTabMode === 'search' && (
        <div className="space-y-6">
          {/* Quick Agronomic Research Scenarios — demo curated, live search for real users */}
          {isDemo ? (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xxs font-mono font-bold text-emerald-700 dark:text-emerald-400 ">
                    {t('ui_index_verified_research_scenarios')}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xxs font-mono border border-amber-500/20">
                    {t('ui_index_demo')}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-white/40">{t('ui_index_select_a_verified_benchmark_to_run_s')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {RESEARCH_SCENARIOS.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => handleTriggerScenario(sc)}
                    className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50/60 dark:bg-slate-950/50 dark:hover:bg-emerald-500/10 border border-slate-200/80 hover:border-emerald-500/40 dark:border-white/5 dark:hover:border-emerald-500/30 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          {sc.crop}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">{sc.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {sc.title}
                      </h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-white/5 text-[10px] text-slate-500 group-hover:text-emerald-600 dark:text-white/40 dark:group-hover:text-emerald-400 flex items-center justify-between font-mono">
                      <span>{t('ui_index_load_grounded_protocol')}</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-600 dark:text-white/60">{t('ui_index_demo_scenarios_are_available_in_the')}</p>
            </div>
          )}

          {/* Multi-Modal Research Search Bar */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={q => {
                setSearchQuery(q);
                setIntakeDismissed(false);
              }}
              attachments={attachments}
              setAttachments={setAttachments}
              isAsking={isAsking}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              showStats={false}
              setShowStats={() => setActiveTabMode('telemetry')}
              onSearch={() => handleSearch()}
            />

            {/* Dynamic Agronomic Intake Clarification Card */}
            {isAgronomicQueryAmbiguous(searchQuery) && !intakeDismissed && !isAsking && (
              <AgronomicIntakeCard
                initialQuery={searchQuery}
                onApplyIntake={enrichedQuery => {
                  setSearchQuery(enrichedQuery);
                  performAISearch(enrichedQuery);
                }}
                onBypass={() => {
                  setIntakeDismissed(true);
                  performAISearch(searchQuery);
                }}
              />
            )}
          </div>

          {/* Live Multi-Step Retrieval Tracer */}
          {isAsking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-white/[0.03] border border-emerald-500/30 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono ">
                  {t('ui_index_neural_rag_pipeline_active')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  '1. Vector Ingestion',
                  '2. Graph Traversal',
                  '3. Re-Ranking',
                  '4. Grounded Synthesis',
                ].map((step, idx) => {
                  const isDone = retrievalStep > idx + 1;
                  const isCurrent = retrievalStep === idx + 1;
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-center text-xs font-mono transition-colors ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : isCurrent
                          ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/40'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-white/5 dark:text-white/30 dark:border-white/5'
                      }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Answer & Grounded Evidence Card */}
          <AnimatePresence mode="wait">
            {lastResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6 space-y-6"
              >
                {/* Result Top Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${lastResult.failed ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="text-xs font-medium text-slate-900 dark:text-white font-mono">
                      {resultHeading(lastResult)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => performAISearch(lastResult.query || searchQuery, true)}
                      disabled={isAsking}
                      title="Bypass cache and generate fresh real-time LLM synthesis"
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('ui_index_regenerate_live')}</span>
                    </button>

                    <button
                      onClick={() => setActiveTabMode('graph')}
                      className="px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>{t('ui_index_inspect_in_citation_graph')}</span>
                    </button>

                    <button
                      onClick={() => setActiveTabMode('workbench')}
                      className="px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('ui_index_launch_spatial_simulator')}</span>
                    </button>
                  </div>
                </div>

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
              </motion.div>
            ) : (
              <div className="backdrop-blur-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl p-12 text-center space-y-3">
                <Compass className="w-10 h-10 text-emerald-600/40 dark:text-emerald-400/40 mx-auto" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{t('ui_index_spatial_knowledge_engine_ready')}</h4>
                <p className="text-xs text-slate-600 dark:text-white/50 max-w-md mx-auto">
                  {t('ui_index_select_a_research_scenario_above_or')}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 2: RAG Knowledge Graph ── */}
      {activeTabMode === 'graph' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <span>{t('ui_index_topological_citation_concept_mesh')}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md text-xxs font-mono font-medium bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
                    {t('ui_index_force_directed_webgl')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                  {t('ui_index_interactive_multi_hop_citation_graph')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 text-xxs font-mono text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span>{t('ui_index_60_fps_graph_renderer')}</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <RagKnowledgeGraphCanvas
                customNodes={graphNodes}
                onNodeSelect={node => {
                  setSelectedNode(node);
                  toast(`Selected Citation: ${node.label}`);
                }}
                className="w-full h-[520px] rounded-xl border border-slate-200 dark:border-white/10"
              />

              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-500/40 text-xs space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{selectedNode.label}</span>
                      <span className="text-xxs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60">
                        {t('ui_index_type', { category: selectedNode.category })}
                      </span>
                    </div>
                    <span className="font-mono text-xxs px-2.5 py-1 rounded bg-slate-500/10 text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                      {t('ui_index_relevance_score')} {(((selectedNode.score ?? 0.9)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-white/80 text-xs leading-relaxed">{selectedNode.snippet}</p>
                </motion.div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xxs font-mono text-slate-500 dark:text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('ui_index_grounding_guard_on_citations_are_che')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabMode('search')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{t('ui_index_back_to_search_synthesis')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Spatial Simulators ── */}
      {activeTabMode === 'workbench' && (
        <div className="space-y-6">
          {/* Spatial Canvas Mode Switcher Bar */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-2.5 flex items-center justify-between overflow-x-auto gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCanvasMode('phenology')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'phenology'
                    ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/40 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200/80 dark:text-white/60 dark:hover:text-white dark:bg-slate-950/40 dark:border-transparent'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{t('ui_index_phenology_scrubber')}</span>
              </button>

              <button
                onClick={() => setActiveCanvasMode('soil_heatmap')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'soil_heatmap'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200/80 dark:text-white/60 dark:hover:text-white dark:bg-slate-950/40 dark:border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t('ui_index_soil_heatmap_grid')}</span>
              </button>

              <button
                onClick={() => setActiveCanvasMode('pathology')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'pathology'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200/80 dark:text-white/60 dark:hover:text-white dark:bg-slate-950/40 dark:border-transparent'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('ui_index_pathology_scanner')}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 text-xxs font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span>{t('ui_index_60_fps_webgl_simulators')}</span>
            </div>
          </div>

          {/* Active Canvas Display Shell */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6 relative min-h-[520px] flex flex-col justify-between overflow-hidden">
            <div className="w-full flex-1">
              {activeCanvasMode === 'phenology' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-white/70">
                    <span>{t('ui_index_crop_growth_stages')}</span>
                    <span className="text-amber-600 dark:text-amber-300">{t('ui_index_illustration_not_field_data')}</span>
                  </div>
                  <div className="w-full h-[460px] min-h-[460px] relative">
                    <AgroEcosystemCanvasScrubber
                      interactive={true}
                      showControls={true}
                      autoPlay={true}
                      className="w-full h-full rounded-xl border border-slate-200 dark:border-white/10"
                    />
                  </div>
                </div>
              )}

              {activeCanvasMode === 'soil_heatmap' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-white/70">
                    <span className="flex items-center gap-2">{t('ui_index_spatial_soil_chemistry_ph_heatmap_is')} {!isDemo && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10">{t('ui_index_live_requires_farmer')}</span>}</span>
                    <span className="text-amber-600 dark:text-amber-400">{isDemo ? 'Demo preview — click cells' : 'Select farmer in Soil Diagnostics for live tile'}</span>
                  </div>
                  {isDemo ? (
                    <div className="w-full h-[460px] min-h-[460px] relative">
                      <SoilNutrientHeatmapCanvas
                        onProbeSelect={(probe: SoilProbeResult) => {
                          toast(`Soil ${probe.label}: ${probe.value.toFixed(1)} ${probe.unit} (${probe.status})`);
                        }}
                        className="w-full h-full rounded-xl border border-slate-200 dark:border-white/10"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-[460px] min-h-[460px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-950/40 flex flex-col items-center justify-center p-8 text-center">
                      <Layers className="w-10 h-10 text-slate-400 dark:text-white/20 mb-2" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t('ui_index_live_soil_tile_per_farmer')}</p>
                      <p className="text-xs text-slate-600 dark:text-white/50 mt-1 max-w-md">{t('ui_index_this_demo_mesh_is_visible_only_in_th')} <span className="text-emerald-600 dark:text-emerald-300">{t('ui_index_disease_diagnosis_soil_diagnostics')}</span>{t('ui_index_select_a_farmer_and_the_heatmap_will')}</p>
                    </div>
                  )}
                </div>
              )}

              {activeCanvasMode === 'pathology' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-white/70">
                    <span>{t('ui_index_neural_foliar_saliency_pathology_sca')}</span>
                    <span className="text-rose-600 dark:text-rose-400">{t('ui_index_edge_ai_detection_active')}</span>
                  </div>
                  <div className="w-full h-[460px] min-h-[460px] relative">
                    <DiseaseSaliencyCanvas
                      onSelectZone={(zone: LesionDetectionZone) => {
                        toast(`Detected: ${zone.label} (${(zone.confidence * 100).toFixed(0)}% Confidence)`);
                      }}
                      className="w-full h-full rounded-xl border border-slate-200 dark:border-white/10"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xxs font-mono text-slate-500 dark:text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('ui_index_grounding_guard_on_citations_are_che')}</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={async () => {
                    if (!lastResult?.query && !searchQuery) {
                      toast.error('Run a search first to generate a factsheet');
                      return;
                    }
                    const query = lastResult?.query || searchQuery || 'Knowledge factsheet';
                    try {
                      const { generateReport } = await import('@/api/reportService');
                      const { downloadReportPdf } = await import('@/api/reportService');
                      const gen = await generateReport('knowledge_factsheet', query.slice(0, 80));
                      const reportId = (gen as { data?: { id?: string } })?.data?.id || (gen as { id?: string })?.id;
                      if (!reportId) throw new Error('No report id');
                      const blob = await downloadReportPdf(reportId);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `factsheet-${Date.now()}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Factsheet PDF downloaded');
                    } catch (e) {
                      toast.error((e as Error).message || 'Factsheet export failed');
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('ui_index_export_factsheet_pdf')}</span>
                </button>

                <button
                  onClick={async () => {
                    if (!lastResult?.answer) {
                      toast.error('Run a search first to broadcast');
                      return;
                    }
                    try {
                      toast('Opening SMS bulk composer with last answer…');
                      const { useAppStore } = await import('@/store/useAppStore');
                      useAppStore.getState().setPendingSMS({ phone: '', message: lastResult.answer.replace(/\*\*/g, '').slice(0, 300) });
                      setActiveTab('sms' as never);
                    } catch {
                      toast.error('Broadcast requires SMS cohort — open SMS page');
                    }
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('ui_index_broadcast_advisory_sms')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Document Library & Catalog ── */}
      {activeTabMode === 'library' && (
        <div className="space-y-6">
          {/* Library Control Bar */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Search within documents */}
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
              <input
                type="text"
                value={librarySearchQuery}
                onChange={e => setLibrarySearchQuery(e.target.value)}
                placeholder="Search articles, crop guides, scientific bulletins..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 text-xs font-medium focus:outline-none focus:border-slate-500/50"
              />
              {librarySearchQuery && (
                <button
                  onClick={() => setLibrarySearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0 hidden sm:block" />
              {['All', 'Agronomy', 'IPM & Pest', 'Soil Chemistry', 'Climatology', 'Horticulture'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setLibraryFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                    libraryFilterCategory === cat
                      ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/40 shadow-sm shadow-slate-950/40'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-white/50 dark:border-white/5 dark:hover:border-white/15 dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick Actions: Offline Pack & Ingest */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={async () => {
                  try {
                    await downloadKnowledgePack('global', 200);
                    toast.success('Offline Knowledge Pack downloaded successfully');
                  } catch {
                    toast.error('Failed to export offline knowledge pack');
                  }
                }}
                className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>{t('ui_index_export_offline_pack')}</span>
              </button>

              <input
                type="file"
                accept=".pdf,.md,.txt,.docx"
                className="hidden"
                id="kb-doc-upload-input"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 8 * 1024 * 1024) {
                    toast.error('File too large — max 8MB');
                    e.target.value = '';
                    return;
                  }
                  const text = await file.text().catch(() => '');
                  if (!text.trim()) {
                    toast.error('Could not read file text — try a .md or .txt export');
                    e.target.value = '';
                    return;
                  }
                  try {
                    const title = file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Uploaded Knowledge Doc';
                    const { data } = await (await import('@/api/client')).default.post('/knowledge', {
                      title,
                      content: text.slice(0, 200000),
                      contentType: 'text',
                      category: 'Agronomy',
                      tags: ['upload', file.name],
                    });
                    if (data?.success) {
                      toast.success(`Ingested "${title}" — ${data.data?.id ? 'indexed' : 'queued'}`);
                      fetchStats();
                    } else toast.error(data?.error || 'Upload failed');
                  } catch (err) {
                    toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed');
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
              <label
                htmlFor="kb-doc-upload-input"
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold transition-all shadow-lg shadow-slate-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('ui_index_upload_technical_doc')}</span>
              </label>
            </div>
          </div>

          {/* Articles Grid — demo catalog only in demo account; real users see ingested docs via Search */}
          {isDemo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredArticles.map(art => (
                <motion.div
                  key={art.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] hover:border-slate-500/40 dark:border-white/[0.08] dark:hover:border-slate-500/40 rounded-lg p-5 flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-md text-xxs font-mono font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
                        {art.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-white/40">{art.readingTime}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-700 dark:text-white dark:group-hover:text-slate-300 transition-colors line-clamp-2">
                        {art.title}
                      </h3>
                      <p className="text-xxs text-slate-500 dark:text-white/50 font-mono mt-1">{art.author}</p>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-white/70 leading-relaxed line-clamp-3">
                      {art.excerpt}
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xxs font-mono text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('ui_index_embed_chunks', { chunks: art.chunks })}</span>
                    </div>

                    <button
                      onClick={() => setSelectedArticle(art)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-500/20 border border-slate-200 hover:border-slate-500/30 text-slate-700 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-slate-500/20 dark:border-white/10 dark:hover:border-slate-500/30 dark:text-white/80 dark:hover:text-white text-xxs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span>{t('ui_index_read_article')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-slate-400 dark:text-white/20 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t('ui_index_document_library_demo_preview')}</p>
              <p className="text-xs text-slate-600 dark:text-white/50 mt-1 max-w-md mx-auto">{t('ui_index_the_4_curated_fao_isric_kalro_demo_d')}</p>
            </div>
          )}

          {/* Detailed Document Reader Modal */}
          <AnimatePresence>
            {selectedArticle && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-4 bg-slate-50 dark:bg-slate-950/60">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xxs font-mono font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
                          {selectedArticle.category}
                        </span>
                        <span className="text-xxs font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {t('ui_index_verified_document')}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{selectedArticle.title}</h2>
                      <p className="text-xs text-slate-500 dark:text-white/50 font-mono mt-0.5">{selectedArticle.author}</p>
                    </div>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70 dark:hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-4 prose dark:prose-invert max-w-none text-xs text-slate-700 dark:text-white/80 leading-relaxed font-sans">
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                      <strong>{t('ui_index_rag_vector_metadata')}</strong> {selectedArticle.chunks} {t('ui_index_high_dimensional_embedding_chunks_in')}
                    </div>
                    <div className="whitespace-pre-line leading-relaxed">
                      {selectedArticle.fullText}
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
                    <button
                      onClick={() => {
                        handleTriggerScenario({
                          id: selectedArticle.id,
                          title: selectedArticle.title,
                          crop: selectedArticle.crop,
                          category: selectedArticle.category,
                          badge: 'Catalog Verified',
                          query: `How to apply ${selectedArticle.title} in smallholder farms?`,
                          canvasMode: selectedArticle.category === 'Soil Chemistry' ? 'soil_heatmap' : selectedArticle.category === 'Climatology' ? 'phenology' : 'pathology',
                          sampleAnswer: selectedArticle.excerpt,
                          citations: [
                            {
                              sourceId: selectedArticle.id,
                              title: selectedArticle.title,
                              category: selectedArticle.category,
                              excerpt: selectedArticle.excerpt,
                              score: 0.98,
                            },
                          ],
                        });
                        setSelectedArticle(null);
                        setActiveTabMode('search');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{t('ui_index_run_inquiry_in_search_synthesis')}</span>
                    </button>

                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white text-xs font-bold transition-all"
                    >
                      {t('common_close')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 5: Index Telemetry ── */}
      {activeTabMode === 'telemetry' && (
        <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6">
          {stats && <KnowledgeStats data={stats} />}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
