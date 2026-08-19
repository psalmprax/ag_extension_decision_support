import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Brain, Info, Sparkles, Zap } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Badge } from '../ui/Badge';
import { ReasoningVisuals } from './ReasoningVisuals';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Citation, KnowledgeEvidenceStatus } from '@/api/knowledgeService';
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

export const AIResult: React.FC<AIResultProps> = ({ result }) => {
  const { radiusClass } = useThemeClasses();

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* AI Answer Card */}
      <div className="card p-10 bg-white dark:bg-gray-800 shadow-2xl border-primary-50/50 dark:border-primary-900/30 border-2 relative overflow-hidden">
        {result.cached && (
          <Badge variant="success" size="sm" className="absolute top-4 right-4">
            <Zap className="w-3 h-3 fill-current" />
            Optimized Cache
          </Badge>
        )}

        <div className="flex items-start gap-4 mb-8">
          <div
            className={`p-3 bg-primary-100 dark:bg-primary-900/40 ${radiusClass} text-primary-600 dark:text-primary-400`}
          >
            <Brain className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-400 uppercase tracking-widest mb-1">
              ALFA Reasoning Results
            </h2>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Expert recommendation for: "{result.query}"
            </p>
          </div>
        </div>

        {/* Markdown results */}
        <MarkdownRenderer content={result.answer} />

        {result.evidenceStatus && result.evidenceStatus !== 'verified_sources' && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Evidence status</p>
              <p className="mt-1 text-sm">
                {result.evidenceStatus === 'context_only'
                  ? 'This answer uses retrieved context, but no verified citations were attached.'
                  : 'No verified source was available. Treat this answer as unverified and confirm it with an agronomist.'}
              </p>
            </div>
          </div>
        )}

        {/* Visual Intelligence Layer */}
        {(result.visuals || result.audio) && (
          <div
            className={`mt-12 mb-16 p-1 bg-gradient-to-br from-primary-500/5 to-transparent rounded-[2.5rem] border border-primary-500/10`}
          >
            <ReasoningVisuals
              visuals={(result.visuals ?? {}) as VisualsData}
              audio={result.audio}
            />
          </div>
        )}

        {/* Context Sources */}
        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700/50 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Contextual Verification Sources
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {result.contextUsed.map((ctx, i) => (
              <div
                key={i}
                className={`px-4 py-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 ${radiusClass} flex items-center gap-2 group hover:border-primary-500/50 transition-colors cursor-pointer`}
              >
                <div className="w-2 h-2 bg-primary-500 rounded-full shadow-[0_0_8px_var(--color-outline)]"></div>
                <div className="flex flex-col">
                  <span className="text-xxs font-black text-gray-400 uppercase leading-none mb-1">
                    Source
                  </span>
                  <span
                    className="text-xs font-bold text-gray-700 dark:text-gray-300 max-w-[220px] truncate"
                    title={ctx.metadata?.sourceUrl || ctx.metadata?.title || ''}
                  >
                    {ctx.metadata?.title ||
                      `${ctx.metadata?.crop || 'General'} / ${ctx.metadata?.category || 'Expert Advice'}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RAG v2 Citations */}
        {result.citations && result.citations.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                RAG v2 Citations
              </span>
              <Badge variant="info" size="sm">
                Enhanced
              </Badge>
            </div>
            <div className="space-y-3">
              {result.citations.map((cite, i) => (
                <div
                  key={i}
                  className={`p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 ${radiusClass}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {cite.title}
                    </span>
                    <Badge variant="warning" size="sm">
                      {cite.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {cite.excerpt}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[120px]">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round(cite.score * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xxs font-bold text-gray-500">
                      {Math.round(cite.score * 100)}% match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
