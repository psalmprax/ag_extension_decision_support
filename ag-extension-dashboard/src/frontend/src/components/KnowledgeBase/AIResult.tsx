import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Share2,
  Network,
  BarChart2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Bookmark,
  Layers,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Badge } from '../ui/Badge';
import { ReasoningVisuals } from './ReasoningVisuals';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Citation, KnowledgeEvidenceStatus } from '@/api/knowledgeService';
import { RagKnowledgeGraphCanvas, GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import { RefractiveGlassCard } from '../canvas-ui/RefractiveGlassCard';
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
}

interface AIResultProps {
  result: Result;
}

type ViewMode = 'synthesis' | 'graph' | 'visuals' | 'evidence';

export const AIResult: React.FC<AIResultProps> = ({ result }) => {
  const { radiusClass } = useThemeClasses();
  const [viewMode, setViewMode] = useState<ViewMode>('synthesis');
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null);
  const [savedBookmark, setSavedBookmark] = useState(false);

  // Transform retrieved context and citations into dynamic knowledge graph nodes
  const customGraphNodes = useMemo<GraphNode[]>(() => {
    const nodes: GraphNode[] = [];

    // Root query node
    const queryLabel = result.query || 'Agronomic Inquiry';
    nodes.push({
      id: 'query-root',
      label: queryLabel.length > 32 ? `${queryLabel.slice(0, 30)}...` : queryLabel,
      category: 'farmer',
      snippet: `Inquiry focus: "${result.query || 'General guidance'}"`,
      score: 1.0,
    });

    // Retrieved context items
    (result.contextUsed || []).forEach((ctx, idx) => {
      const isNasa = (ctx.metadata?.sourceUrl || '').toLowerCase().includes('nasa') || (ctx.metadata?.title || '').toLowerCase().includes('weather');
      const isSoil = (ctx.metadata?.category || '').toLowerCase().includes('soil') || (ctx.metadata?.title || '').toLowerCase().includes('soil');
      const category: GraphNode['category'] = isNasa ? 'nasa' : isSoil ? 'soil' : 'fao';

      const title = ctx.metadata?.title || `${ctx.metadata?.crop || 'Crop'} Guidance #${idx + 1}`;
      nodes.push({
        id: `ctx-${idx}`,
        label: title.length > 28 ? `${title.slice(0, 26)}...` : title,
        category,
        snippet: ctx.content ? ctx.content.slice(0, 160) : 'Context record for agronomic decision support.',
        score: ctx.score ?? (0.85 - idx * 0.05),
      });
    });

    // Citations
    (result.citations || []).forEach((cite, idx) => {
      nodes.push({
        id: `cite-${idx}`,
        label: cite.title.length > 28 ? `${cite.title.slice(0, 26)}...` : cite.title,
        category: 'rule',
        snippet: cite.excerpt || 'Verified agronomic rule citation.',
        score: cite.score ?? 0.9,
      });
    });

    return nodes;
  }, [result]);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    toast.success('Executive synthesis copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Voice playback not supported on this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const plainText = result.answer.replace(/[*#`_\[\]()]/g, '');
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      toast.success('Playing voice briefing...');
    }
  };

  const handleBookmark = () => {
    setSavedBookmark(!savedBookmark);
    toast.success(savedBookmark ? 'Removed from saved advisories' : 'Saved to advisor knowledge cache');
  };

  const hasVisuals = Boolean(
    (result.visuals?.kpis && result.visuals.kpis.length > 0) ||
    (result.visuals?.charts && result.visuals.charts.length > 0) ||
    (result.visuals?.images && result.visuals.images.length > 0) ||
    result.audio
  );

  const contextCount = result.contextUsed?.length || 0;
  const citationCount = result.citations?.length || 0;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* ── Top Canvas HUD Card ── */}
      <RefractiveGlassCard className="p-6 sm:p-8 bg-slate-900/90 border border-emerald-500/20 shadow-2xl backdrop-blur-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40 shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xxs font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ALFA Spatial Reasoning
                </span>
                {result.cached && (
                  <span className="text-xxs font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    Semantic Cache (0.04s)
                  </span>
                )}
                {result.evidenceStatus === 'verified_sources' && (
                  <span className="text-xxs font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Verified Evidence
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-1 truncate">
                {result.query ? `"${result.query}"` : 'Agronomic Synthesis'}
              </h2>
            </div>
          </div>

          {/* Quick HUD Actions */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
            <button
              onClick={handleToggleSpeech}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                isSpeaking
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
              title="Voice Briefing"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4 text-emerald-400" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isSpeaking ? 'Stop Audio' : 'Audio Brief'}</span>
            </button>

            <button
              onClick={handleCopyAnswer}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              title="Copy Summary"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleBookmark}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                savedBookmark
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
              title="Bookmark Advisory"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">{savedBookmark ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* ── Spatial Segmented View Switcher (KnockKnock/CanvasUI) ── */}
        <div className="flex items-center justify-between gap-2 pt-4 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-2xl border border-white/10">
            <button
              onClick={() => setViewMode('synthesis')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'synthesis'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Advisory Synthesis</span>
            </button>

            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'graph'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Knowledge Graph</span>
              <span className="text-xxs px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-300">
                {customGraphNodes.length}
              </span>
            </button>

            {hasVisuals && (
              <button
                onClick={() => setViewMode('visuals')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'visuals'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Visuals & KPIs</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('evidence')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'evidence'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Evidence & Sources</span>
              <span className="text-xxs px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-300">
                {contextCount + citationCount}
              </span>
            </button>
          </div>
        </div>
      </RefractiveGlassCard>

      {/* ── Viewport Contents ── */}
      <AnimatePresence mode="wait">
        {/* VIEW 1: ADVISORY SYNTHESIS */}
        {viewMode === 'synthesis' && (
          <motion.div
            key="synthesis-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl space-y-6">
              {/* Evidence Status Alert if unverified */}
              {result.evidenceStatus && result.evidenceStatus !== 'verified_sources' && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Evidence Status Notice</p>
                    <p className="mt-1 text-xs text-amber-100/90">
                      {result.evidenceStatus === 'context_only'
                        ? 'Synthesized using retrieved knowledge chunks without definitive rule citations. Recommended for verification.'
                        : 'Retrieved context is sparse. Treat as an estimate and cross-reference with localized field testing.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Main Markdown Synthesis Output */}
              <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-sans">
                <MarkdownRenderer content={result.answer} />
              </div>

              {/* Verified Sources Pill Bar */}
              {result.contextUsed && result.contextUsed.length > 0 && (
                <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Retrieved Verification Context
                    </span>
                    <button
                      onClick={() => setViewMode('evidence')}
                      className="text-xxs font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      View all ({result.contextUsed.length}) sources &rarr;
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.contextUsed.slice(0, 4).map((ctx, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/5 text-xxs font-semibold text-slate-300 flex items-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="truncate max-w-[200px]">
                          {ctx.metadata?.title || `${ctx.metadata?.crop || 'Crop'} / ${ctx.metadata?.category || 'Guidance'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 2: INTERACTIVE KNOWLEDGE GRAPH CANVAS (CanvasUI / KnockKnock) */}
        {viewMode === 'graph' && (
          <motion.div
            key="graph-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Network className="w-4 h-4 text-emerald-400" />
                    Spatial Knowledge Graph Explorer
                  </h3>
                  <p className="text-xxs text-slate-400">
                    Live semantic node network connecting query concepts, soil indices, FAO literature, and regional farmer records.
                  </p>
                </div>
                <span className="text-xxs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Physics: Active
                </span>
              </div>

              <div className="h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950 relative">
                <RagKnowledgeGraphCanvas
                  className="w-full h-full"
                  customNodes={customGraphNodes}
                  onNodeSelect={node => setSelectedGraphNode(node)}
                />
              </div>

              {/* Interactive Node Drawer / Selected Entity Inspection */}
              {selectedGraphNode && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-start justify-between gap-4 animate-in fade-in">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{selectedGraphNode.label}</span>
                      <span className="text-xxs uppercase px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-400">
                        {selectedGraphNode.category}
                      </span>
                      {selectedGraphNode.score && (
                        <span className="text-xxs font-mono text-slate-400">
                          Relevance: {Math.round(selectedGraphNode.score * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{selectedGraphNode.snippet}</p>
                  </div>
                  <button
                    onClick={() => setSelectedGraphNode(null)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW 3: VISUALS & KPIS */}
        {viewMode === 'visuals' && (
          <motion.div
            key="visuals-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl"
          >
            <ReasoningVisuals
              visuals={(result.visuals ?? {}) as VisualsData}
              audio={result.audio}
            />
          </motion.div>
        )}

        {/* VIEW 4: EVIDENCE & CITATIONS */}
        {viewMode === 'evidence' && (
          <motion.div
            key="evidence-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Primary Evidence & Verification Provenance
                </h3>
                <p className="text-xxs text-slate-400 mt-0.5">
                  Full citation grounding retrieved from verified agronomic repositories and vector indices.
                </p>
              </div>

              {/* Citations Grid */}
              {result.citations && result.citations.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xxs font-black text-slate-400 uppercase tracking-widest">
                    Formal Agronomic Citations ({result.citations.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.citations.map((cite, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate max-w-[200px]">
                            {cite.title}
                          </span>
                          <span className="text-xxs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold">
                            {cite.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                          {cite.excerpt}
                        </p>
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xxs text-slate-400 font-mono">
                          <span>Relevance Score</span>
                          <span className="text-amber-400 font-bold">{Math.round(cite.score * 100)}% match</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Sources Grid */}
              {result.contextUsed && result.contextUsed.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <span className="text-xxs font-black text-slate-400 uppercase tracking-widest">
                    Retrieved Knowledge Vectors ({result.contextUsed.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.contextUsed.map((ctx, i) => {
                      const hasUrl = ctx.metadata?.sourceUrl && ctx.metadata.sourceUrl.startsWith('http');
                      const Component = hasUrl ? 'a' : 'div';
                      const linkProps = hasUrl
                        ? {
                            href: ctx.metadata?.sourceUrl,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          }
                        : {};

                      return (
                        <Component
                          key={i}
                          {...linkProps}
                          className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-emerald-500/40 transition-all text-left flex flex-col justify-between gap-2 group"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xxs font-black text-emerald-400 uppercase">
                                {ctx.metadata?.category || 'Vector Chunk'}
                              </span>
                              {hasUrl && (
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                              {ctx.metadata?.title || `${ctx.metadata?.crop || 'General'} Advice`}
                            </h4>
                            <p className="text-xxs text-slate-400 line-clamp-2 mt-1">
                              {ctx.content}
                            </p>
                          </div>
                        </Component>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIResult;
