import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Network,
  BarChart2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Bookmark,
  Layers,
  Globe,
  RefreshCw,
  Columns,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ReasoningVisuals } from './ReasoningVisuals';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Citation, KnowledgeEvidenceStatus, translateContent } from '@/api/knowledgeService';
import { RagKnowledgeGraphCanvas, GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import { RefractiveGlassCard } from '../canvas-ui/RefractiveGlassCard';
import type { VisualsData } from './types';
import { MULTILINGUAL_LANGUAGES } from './languages';

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

function buildQueryNode(query?: string): GraphNode {
  const queryLabel = query || 'Agronomic Inquiry';
  return {
    id: 'query-root',
    label: queryLabel.length > 32 ? `${queryLabel.slice(0, 30)}...` : queryLabel,
    category: 'farmer',
    snippet: `Inquiry focus: "${query || 'General guidance'}"`,
    score: 1.0,
  };
}

function resolveContextCategory(ctx: ContextItem): GraphNode['category'] {
  const url = (ctx.metadata?.sourceUrl || '').toLowerCase();
  const title = (ctx.metadata?.title || '').toLowerCase();
  const cat = (ctx.metadata?.category || '').toLowerCase();
  if (url.includes('nasa') || title.includes('weather')) return 'nasa';
  if (cat.includes('soil') || title.includes('soil')) return 'soil';
  return 'fao';
}

function buildContextNodes(contextUsed: ContextItem[] = []): GraphNode[] {
  return contextUsed.map((ctx, idx) => {
    const category = resolveContextCategory(ctx);
    const title = ctx.metadata?.title || `${ctx.metadata?.crop || 'Crop'} Guidance #${idx + 1}`;
    return {
      id: `ctx-${idx}`,
      label: title.length > 28 ? `${title.slice(0, 26)}...` : title,
      category,
      snippet: ctx.content ? ctx.content.slice(0, 160) : 'Context record for agronomic decision support.',
      score: ctx.score ?? (0.85 - idx * 0.05),
    };
  });
}

function buildCitationNodes(citations: Citation[] = []): GraphNode[] {
  return citations.map((cite, idx) => ({
    id: `cite-${idx}`,
    label: cite.title.length > 28 ? `${cite.title.slice(0, 26)}...` : cite.title,
    category: 'rule',
    snippet: cite.excerpt || 'Verified agronomic rule citation.',
    score: cite.score ?? 0.9,
  }));
}

function buildGraphNodes(result: Result): GraphNode[] {
  return [
    buildQueryNode(result.query),
    ...buildContextNodes(result.contextUsed),
    ...buildCitationNodes(result.citations),
  ];
}

interface SynthesisViewProps {
  result: Result;
  activeLang: string;
  onSelectLanguage: (code: string) => void;
  isTranslating: boolean;
  translations: Record<string, string>;
  dualView: boolean;
  setDualView: (v: boolean) => void;
  onSwitchToEvidence: () => void;
}

const SynthesisView: React.FC<SynthesisViewProps> = ({
  result,
  activeLang,
  onSelectLanguage,
  isTranslating,
  translations,
  dualView,
  setDualView,
  onSwitchToEvidence,
}) => {
  const activeContent = translations[activeLang] || result.answer;
  const originalContent = translations['en'] || result.answer;
  const currentLangObj = MULTILINGUAL_LANGUAGES.find(l => l.code === activeLang) || MULTILINGUAL_LANGUAGES[0];

  const featuredCodes = ['en', 'sw', 'fr', 'es', 'pt', 'ha', 'yo', 'ig', 'am', 'ar', 'hi', 'zh'];
  const featuredLanguages = MULTILINGUAL_LANGUAGES.filter(l => featuredCodes.includes(l.code));
  const africanLanguages = MULTILINGUAL_LANGUAGES.filter(l => l.group === 'African');
  const globalLanguages = MULTILINGUAL_LANGUAGES.filter(l => l.group === 'Global');

  return (
    <motion.div
      key="synthesis-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* ── Multilingual Translation & Dual-View Bar ── */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 shadow-xl backdrop-blur-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider pr-2 border-r border-white/10">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Localize ({MULTILINGUAL_LANGUAGES.length} Languages):</span>
          </div>

          {/* Quick-Access Featured Language Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {featuredLanguages.map(lang => {
              const isSelected = activeLang === lang.code;
              return (
                <button
                  key={lang.code}
                  disabled={isTranslating}
                  onClick={() => onSelectLanguage(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-950/40 scale-105'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5'
                  }`}
                  title={`Translate to ${lang.native} (${lang.label})`}
                >
                  <span>{lang.flag}</span>
                  <span className="font-bold">{lang.native}</span>
                </button>
              );
            })}
          </div>

          {/* All 48+ Languages Grouped Dropdown */}
          <div className="relative flex items-center">
            <select
              value={activeLang}
              disabled={isTranslating}
              onChange={e => onSelectLanguage(e.target.value)}
              className="appearance-none bg-slate-950/90 hover:bg-slate-950 text-white text-xs font-mono font-bold py-1.5 pl-3 pr-8 rounded-xl border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="" disabled>All Languages ({MULTILINGUAL_LANGUAGES.length}) ▾</option>
              <optgroup label="── African Agricultural & Regional ──">
                {africanLanguages.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.native} ({l.label})
                  </option>
                ))}
              </optgroup>
              <optgroup label="── Global Agricultural & Regional ──">
                {globalLanguages.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.native} ({l.label})
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/50 absolute right-2.5 pointer-events-none" />
          </div>
        </div>

        {activeLang !== 'en' && (
          <button
            onClick={() => setDualView(!dualView)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              dualView
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/40'
                : 'bg-white/5 text-white/60 hover:text-white border-white/10'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{dualView ? 'Single View' : 'Split Dual View'}</span>
          </button>
        )}
      </div>

      {isTranslating && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs font-mono animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Generating precision agricultural translation in {currentLangObj.native}...</span>
        </div>
      )}

      <div className="p-6 sm:p-10 rounded-xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl space-y-6">
        {result.evidenceStatus && result.evidenceStatus !== 'verified_sources' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
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

        {/* ── Content View (Dual vs Single) ── */}
        {dualView && activeLang !== 'en' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-mono font-bold text-slate-400 uppercase">
                <span>🇺🇸 English (Primary Grounded Context)</span>
              </div>
              <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-sans text-xs">
                <MarkdownRenderer content={originalContent} />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-950/60 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20 text-xs font-mono font-bold text-emerald-400 uppercase">
                <span>{currentLangObj.flag} {currentLangObj.native} (Localized Farmer Advisory)</span>
              </div>
              <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-sans text-xs">
                <MarkdownRenderer content={activeContent} />
              </div>
            </div>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed font-sans">
            <MarkdownRenderer content={activeContent} />
          </div>
        )}

        {result.contextUsed && result.contextUsed.length > 0 && (
          <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xxs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Retrieved Verification Context
              </span>
              <button
                onClick={onSwitchToEvidence}
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
  );
};

const KnowledgeGraphView: React.FC<{
  customGraphNodes: GraphNode[];
  selectedGraphNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
}> = ({ customGraphNodes, selectedGraphNode, onSelectNode }) => (
  <motion.div
    key="graph-view"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="space-y-4"
  >
    <div className="p-4 sm:p-6 rounded-xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl">
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
        <span className="text-xxs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
          Physics: Active
        </span>
      </div>

      <div className="h-[420px] rounded-xl overflow-hidden border border-white/10 bg-slate-950 relative">
        <RagKnowledgeGraphCanvas
          className="w-full h-full"
          customNodes={customGraphNodes}
          onNodeSelect={node => onSelectNode(node)}
        />
      </div>

      {selectedGraphNode && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-start justify-between gap-4 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">{selectedGraphNode.label}</span>
              <span className="text-xxs uppercase px-2 py-0.5 rounded-md font-black bg-emerald-500/20 text-emerald-400">
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
            onClick={() => onSelectNode(null)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  </motion.div>
);

const EvidenceSourcesView: React.FC<{ result: Result }> = ({ result }) => (
  <motion.div
    key="evidence-view"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="space-y-4"
  >
    <div className="p-6 sm:p-8 rounded-xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Primary Evidence & Verification Provenance
        </h3>
        <p className="text-xxs text-slate-400 mt-0.5">
          Full citation grounding retrieved from verified agronomic repositories and vector indices.
        </p>
      </div>

      {result.citations && result.citations.length > 0 && (
        <div className="space-y-3">
          <span className="text-xxs font-black text-slate-400 uppercase tracking-widest">
            Formal Agronomic Citations ({result.citations.length})
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.citations.map((cite, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate max-w-[200px]">
                    {cite.title}
                  </span>
                  <span className="text-xxs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold">
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
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 hover:border-emerald-500/40 transition-all text-left flex flex-col justify-between gap-2 group"
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
);

const AIResultHeader: React.FC<{
  result: Result;
  isSpeaking: boolean;
  copied: boolean;
  savedBookmark: boolean;
  onToggleSpeech: () => void;
  onCopy: () => void;
  onBookmark: () => void;
}> = ({
  result,
  isSpeaking,
  copied,
  savedBookmark,
  onToggleSpeech,
  onCopy,
  onBookmark,
}) => (
  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40 shrink-0">
        <Brain className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xxs font-black tracking-widest uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ALFA Spatial Reasoning
          </span>
          {result.cached && (
            <span className="text-xxs font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 fill-current" />
              Semantic Cache (0.04s)
            </span>
          )}
          {result.evidenceStatus === 'verified_sources' && (
            <span className="text-xxs font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
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

    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
      <button
        onClick={onToggleSpeech}
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
        onClick={onCopy}
        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
        title="Copy Summary"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      </button>

      <button
        onClick={onBookmark}
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
);

const AIResultNav: React.FC<{
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  graphNodeCount: number;
  hasVisuals: boolean;
  sourceCount: number;
}> = ({ viewMode, setViewMode, graphNodeCount, hasVisuals, sourceCount }) => (
  <div className="flex items-center justify-between gap-2 pt-4 overflow-x-auto custom-scrollbar">
    <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-white/10">
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
        <span className="text-xxs px-1.5 py-0.2 rounded-md bg-slate-900/60 text-slate-300">
          {graphNodeCount}
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
        <span className="text-xxs px-1.5 py-0.2 rounded-md bg-slate-900/60 text-slate-300">
          {sourceCount}
        </span>
      </button>
    </div>
  </div>
);

export const AIResult: React.FC<AIResultProps> = ({ result }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('synthesis');
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null);
  const [savedBookmark, setSavedBookmark] = useState(false);

  // Multilingual localization state
  const [activeLang, setActiveLang] = useState<string>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({ en: result.answer });
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [dualView, setDualView] = useState<boolean>(false);

  useEffect(() => {
    setTranslations({ en: result.answer });
    setActiveLang('en');
    setDualView(false);
  }, [result.answer]);

  const customGraphNodes = useMemo<GraphNode[]>(() => buildGraphNodes(result), [result]);

  const handleSelectLanguage = async (code: string) => {
    if (code === activeLang) return;
    if (translations[code]) {
      setActiveLang(code);
      return;
    }

    const targetLangObj = MULTILINGUAL_LANGUAGES.find(l => l.code === code);
    setIsTranslating(true);
    try {
      const res = await translateContent(result.answer, code);
      if (res.success && res.data?.translatedText) {
        setTranslations(prev => ({
          ...prev,
          [code]: res.data.translatedText,
        }));
        setActiveLang(code);
        toast.success(`Advisory translated to ${targetLangObj?.native || code}!`);
      } else {
        toast.error('Translation failed. Please retry shortly.');
      }
    } catch (err) {
      toast.error('Translation service currently unavailable.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyAnswer = () => {
    const textToCopy = translations[activeLang] || result.answer;
    navigator.clipboard.writeText(textToCopy);
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
      const currentText = translations[activeLang] || result.answer;
      const plainText = currentText.replace(/[*#`_()[\]]/g, '');
      const utterance = new SpeechSynthesisUtterance(plainText);
      const currentLangObj = MULTILINGUAL_LANGUAGES.find(l => l.code === activeLang) || MULTILINGUAL_LANGUAGES[0];
      utterance.lang = currentLangObj.bcp47 || 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      toast.success(`Playing voice briefing (${currentLangObj.native})...`);
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

  const sourceCount = (result.contextUsed?.length || 0) + (result.citations?.length || 0);

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      <RefractiveGlassCard className="p-6 sm:p-8 bg-slate-900/90 border border-emerald-500/20 shadow-2xl backdrop-blur-2xl">
        <AIResultHeader
          result={result}
          isSpeaking={isSpeaking}
          copied={copied}
          savedBookmark={savedBookmark}
          onToggleSpeech={handleToggleSpeech}
          onCopy={handleCopyAnswer}
          onBookmark={handleBookmark}
        />

        <AIResultNav
          viewMode={viewMode}
          setViewMode={setViewMode}
          graphNodeCount={customGraphNodes.length}
          hasVisuals={hasVisuals}
          sourceCount={sourceCount}
        />
      </RefractiveGlassCard>

      <AnimatePresence mode="wait">
        {viewMode === 'synthesis' && (
          <SynthesisView
            result={result}
            activeLang={activeLang}
            onSelectLanguage={handleSelectLanguage}
            isTranslating={isTranslating}
            translations={translations}
            dualView={dualView}
            setDualView={setDualView}
            onSwitchToEvidence={() => setViewMode('evidence')}
          />
        )}
        {viewMode === 'graph' && (
          <KnowledgeGraphView
            customGraphNodes={customGraphNodes}
            selectedGraphNode={selectedGraphNode}
            onSelectNode={setSelectedGraphNode}
          />
        )}
        {viewMode === 'visuals' && (
          <motion.div
            key="visuals-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 sm:p-8 rounded-xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl"
          >
            <ReasoningVisuals
              visuals={(result.visuals ?? {}) as VisualsData}
              audio={result.audio}
            />
          </motion.div>
        )}
        {viewMode === 'evidence' && (
          <EvidenceSourcesView result={result} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIResult;
