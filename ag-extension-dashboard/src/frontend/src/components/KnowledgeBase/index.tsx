import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
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
import { DOCUMENT_CATALOG, type DocumentArticle } from './catalog';
import { RESEARCH_SCENARIOS, type ResearchScenario, type SpatialCanvasMode } from './scenarios';
import { QuotaChip } from './QuotaChip';

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

export const KnowledgeBase: React.FC = () => {
  const { user, addNotification, setActiveTab } = useAppStore();
  const { isDemo } = useDemoMode();
  const [activeTabMode, setActiveTabMode] = useState<KnowledgeTabMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [quota, setQuota] = useState<KnowledgeQuotaData | null>(() => {
    if (user?.role === 'admin') {
      return { allowed: true, current: 0, limit: -1, remaining: 999999, isFree: false };
    }
    return { allowed: true, current: 0, limit: 3, remaining: 3, isFree: true };
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

  const fetchQuotaData = async () => {
    try {
      const res = await fetchKnowledgeQuota();
      if (res.success) setQuota(res.data);
    } catch {
      // In demo or guest mode, keep standard 3/day free tier quota
      if (user?.role !== 'admin') {
        setQuota(prev => prev ?? { allowed: true, current: 0, limit: 3, remaining: 3, isFree: true });
      }
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
    fetchStats();
    fetchQuotaData();
  }, []);

  const performAISearch = async (queryText: string) => {
    setIsAsking(true);
    setRetrievalStep(1);

    const stepInterval = setInterval(() => {
      setRetrievalStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await askAI(queryText, attachments);
      clearInterval(stepInterval);
      setRetrievalStep(4);

      if (!res.success) return;

      setLastResult({
        ...res.data,
        query: queryText || 'Multimodal Search',
        timestamp: new Date().toISOString(),
      });
      setAttachments([]);
      if (typeof res.data.dailyRemaining === 'number' && typeof res.data.dailyLimit === 'number') {
        setQuota(prev => ({
          allowed: res.data.dailyRemaining! > 0,
          current: res.data.dailyLimit! - res.data.dailyRemaining!,
          limit: res.data.dailyLimit!,
          remaining: res.data.dailyRemaining!,
          isFree: prev?.isFree ?? (user?.role !== 'admin'),
        }));
      }
      fetchQuotaData();

      if (res.data.cached) {
        addNotification({
          type: 'info',
          message: 'Result retrieved from semantic cache (Cost optimized)',
        });
      }
    } catch (error: unknown) {
      clearInterval(stepInterval);
      const err = error as { response?: { data?: { error?: string; limitReached?: boolean } } };
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
        message: err.response?.data?.error || 'Knowledge search failed',
      });
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
      {/* ── Top Bento Banner Header ── */}
      <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Agro-Spatial Knowledge Mesh
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  RAG 2.0
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Multi-modal grounded semantic retrieval, topological citation graph, and verified agronomic almanacs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {/* Quota Telemetry Chip — free 3/3 daily, Pro/Admin Unlimited */}
            {quota && <QuotaChip quota={quota} onUpgrade={() => setActiveTab('billing')} />}

            {/* 5-Segmented Mode Switcher */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10 shadow-inner overflow-x-auto">
              <button
                onClick={() => setActiveTabMode('search')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'search'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search & Discovery</span>
              </button>

              <button
                onClick={() => setActiveTabMode('graph')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'graph'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Knowledge Graph</span>
              </button>

              <button
                onClick={() => setActiveTabMode('workbench')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'workbench'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Spatial Simulators</span>
              </button>

              <button
                onClick={() => setActiveTabMode('library')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'library'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Document Library</span>
              </button>

              <button
                onClick={() => setActiveTabMode('telemetry')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'telemetry'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Index Telemetry</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB 1: Search & AI Discovery ── */}
      {activeTabMode === 'search' && (
        <div className="space-y-6">
          {/* Quick Agronomic Research Scenarios — demo curated, live search for real users */}
          {isDemo ? (
            <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xxs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                    Verified Research Scenarios
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xxs font-mono border border-amber-500/20">
                    Demo
                  </span>
                </div>
                <span className="text-xs font-mono text-white/40">Select a verified benchmark to run semantic inquiry</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {RESEARCH_SCENARIOS.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => handleTriggerScenario(sc)}
                    className="p-4 rounded-xl bg-slate-950/50 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {sc.crop}
                        </span>
                        <span className="text-[9px] text-white/40 font-mono">{sc.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {sc.title}
                      </h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/40 group-hover:text-emerald-400 flex items-center justify-between font-mono">
                      <span>Load Grounded Protocol</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">Demo scenarios are available in the demo account — use Search & Discovery above for live RAG over your ingested knowledge base.</p>
            </div>
          )}

          {/* Multi-Modal Research Search Bar */}
          <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-xl p-5 shadow-xl space-y-4">
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
              className="backdrop-blur-xl bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 shadow-xl space-y-2"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-xs font-bold text-white font-mono uppercase">
                  Neural RAG Pipeline Active
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
                      className={`p-2 rounded-xl text-center text-xs font-mono transition-all ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isCurrent
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                          : 'bg-white/5 text-white/30 border border-white/5'
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
                className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-6 shadow-2xl space-y-6"
              >
                {/* Result Top Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                      Grounded Synthesis Completed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTabMode('graph')}
                      className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Inspect in Citation Graph</span>
                    </button>

                    <button
                      onClick={() => setActiveTabMode('workbench')}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Launch Spatial Simulator</span>
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
              <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-xl p-12 text-center space-y-3">
                <Compass className="w-10 h-10 text-emerald-400/40 mx-auto" />
                <h4 className="text-base font-bold text-white">Spatial Knowledge Engine Ready</h4>
                <p className="text-xs text-white/50 max-w-md mx-auto">
                  Select a research scenario above or enter a multi-modal query to explore full-width agronomic recommendations, citations, and interactive models.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 2: RAG Knowledge Graph ── */}
      {activeTabMode === 'graph' && (
        <div className="space-y-6">
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-teal-400" />
                    <span>Topological Citation & Concept Mesh</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md text-xxs font-mono font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    Force-Directed WebGL
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Interactive multi-hop citation graph connecting verified research articles, farmer inquiry roots, and FAO agronomic rules. Click any node to inspect abstracts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xxs font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>60 FPS GRAPH RENDERER</span>
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
                className="w-full h-[520px] rounded-xl border border-white/10"
              />

              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-teal-500/40 text-xs space-y-2 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-teal-300 text-sm">{selectedNode.label}</span>
                      <span className="text-xxs font-mono uppercase px-2 py-0.5 rounded-md bg-white/5 text-white/60">
                        Type: {selectedNode.category}
                      </span>
                    </div>
                    <span className="font-mono text-xxs px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-300 font-bold uppercase">
                      Relevance Score: {(((selectedNode.score ?? 0.9)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed">{selectedNode.snippet}</p>
                </motion.div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xxs font-mono text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Grounding Guard Active (Zero Hallucination Tolerance)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabMode('search')}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Back to Search & Synthesis</span>
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
          <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-xl p-2.5 flex items-center justify-between overflow-x-auto gap-2 shadow-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCanvasMode('phenology')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'phenology'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                    : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Phenology Scrubber</span>
              </button>

              <button
                onClick={() => setActiveCanvasMode('soil_heatmap')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'soil_heatmap'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                    : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Soil Heatmap Grid</span>
              </button>

              <button
                onClick={() => setActiveCanvasMode('pathology')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'pathology'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg'
                    : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pathology Scanner</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xxs font-mono text-emerald-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>60 FPS WEBGL SIMULATORS</span>
            </div>
          </div>

          {/* Active Canvas Display Shell */}
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-6 shadow-2xl relative min-h-[520px] flex flex-col justify-between overflow-hidden">
            <div className="w-full flex-1">
              {activeCanvasMode === 'phenology' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white/70">
                    <span>AGRO-ECOSYSTEM 4-STAGE PHENOLOGY SCRUBBER</span>
                    <span className="text-cyan-400">NASA POWER Synchronized</span>
                  </div>
                  <AgroEcosystemCanvasScrubber
                    interactive={true}
                    showControls={true}
                    autoPlay={true}
                    className="w-full h-[460px] rounded-xl border border-white/10"
                  />
                </div>
              )}

              {activeCanvasMode === 'soil_heatmap' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white/70">
                    <span className="flex items-center gap-2">SPATIAL SOIL CHEMISTRY & PH HEATMAP (ISRIC SoilGrids v2) {!isDemo && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-700 text-white/60 border border-white/10">Live requires farmer</span>}</span>
                    <span className="text-amber-400">{isDemo ? 'Demo preview — click cells' : 'Select farmer in Soil Diagnostics for live tile'}</span>
                  </div>
                  {isDemo ? (
                    <SoilNutrientHeatmapCanvas
                      onProbeSelect={(probe: SoilProbeResult) => {
                        toast(`Soil ${probe.label}: ${probe.value.toFixed(1)} ${probe.unit} (${probe.status})`);
                      }}
                      className="w-full h-[460px] rounded-xl border border-white/10"
                    />
                  ) : (
                    <div className="w-full h-[460px] rounded-xl border border-white/10 bg-slate-950/40 flex flex-col items-center justify-center p-8 text-center">
                      <Layers className="w-10 h-10 text-white/20 mb-2" />
                      <p className="text-sm font-bold text-white">Live Soil Tile — Per-Farmer</p>
                      <p className="text-xs text-white/50 mt-1 max-w-md">This demo mesh is visible only in the demo account. For your farmers, open <span className="text-emerald-300">Disease Diagnosis → Soil Diagnostics</span>, select a farmer, and the heatmap will render live ISRIC 250m + lab-anchored interpolation.</p>
                    </div>
                  )}
                </div>
              )}

              {activeCanvasMode === 'pathology' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white/70">
                    <span>NEURAL FOLIAR SALIENCY & PATHOLOGY SCANNER</span>
                    <span className="text-rose-400">Edge AI Detection Active</span>
                  </div>
                  <DiseaseSaliencyCanvas
                    onSelectZone={(zone: LesionDetectionZone) => {
                      toast(`Detected: ${zone.label} (${(zone.confidence * 100).toFixed(0)}% Confidence)`);
                    }}
                    className="w-full h-[460px] rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xxs font-mono text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Grounding Guard Active (Zero Hallucination Tolerance)</span>
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
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Factsheet PDF</span>
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
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Advisory SMS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Document Library & Catalog ── */}
      {activeTabMode === 'library' && (
        <div className="space-y-6">
          {/* Library Control Bar */}
          <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Search within documents */}
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={librarySearchQuery}
                onChange={e => setLibrarySearchQuery(e.target.value)}
                placeholder="Search articles, crop guides, scientific bulletins..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/40 text-xs font-medium focus:outline-none focus:border-purple-500/50"
              />
              {librarySearchQuery && (
                <button
                  onClick={() => setLibrarySearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0 hidden sm:block" />
              {['All', 'Agronomy', 'IPM & Pest', 'Soil Chemistry', 'Climatology', 'Horticulture'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setLibraryFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                    libraryFilterCategory === cat
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-950/40'
                      : 'bg-white/[0.03] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
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
                className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Export Offline Pack</span>
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
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Technical Doc</span>
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
                  className="backdrop-blur-xl bg-slate-900/70 border border-white/10 hover:border-purple-500/40 rounded-xl p-5 flex flex-col justify-between shadow-xl transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-md text-xxs font-mono font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {art.category}
                      </span>
                      <span className="text-[10px] font-mono text-white/40">{art.readingTime}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                        {art.title}
                      </h3>
                      <p className="text-xxs text-white/50 font-mono mt-1">{art.author}</p>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed line-clamp-3">
                      {art.excerpt}
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xxs font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{art.chunks} Embed Chunks</span>
                    </div>

                    <button
                      onClick={() => setSelectedArticle(art)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-white/80 hover:text-white text-xxs font-bold uppercase transition-all flex items-center gap-1.5"
                    >
                      <span>Read Article</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">Document Library — Demo Preview</p>
              <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">The 4 curated FAO/ISRIC/KALRO demo docs are visible only in the demo account. Your ingested technical docs (Upload Technical Doc above) will appear here and in Search after indexing.</p>
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
                  className="bg-slate-900 border border-white/15 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-slate-950/60">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xxs font-mono font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {selectedArticle.category}
                        </span>
                        <span className="text-xxs font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified Document
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-white">{selectedArticle.title}</h2>
                      <p className="text-xs text-white/50 font-mono mt-0.5">{selectedArticle.author}</p>
                    </div>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-4 prose prose-invert max-w-none text-xs text-white/80 leading-relaxed font-sans">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-emerald-300">
                      <strong>RAG Vector Metadata:</strong> {selectedArticle.chunks} high-dimensional embedding chunks indexed in pgvector.
                    </div>
                    <div className="whitespace-pre-line leading-relaxed">
                      {selectedArticle.fullText}
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
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
                      <span>Run Inquiry in Search & Synthesis</span>
                    </button>

                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 3: Index Telemetry ── */}
      {activeTabMode === 'telemetry' && (
        <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-xl p-6 shadow-2xl">
          {stats && <KnowledgeStats data={stats} />}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
