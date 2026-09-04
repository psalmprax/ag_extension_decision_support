import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Radio } from 'lucide-react';
import type { CanvasViewType } from './rules';
import type { ChatMessageItem } from './response';

export interface MessageStreamProps {
  messages: ChatMessageItem[];
  isProcessing: boolean;
  activeReasoningStep: string | null;
  onSelectCanvas: (view: CanvasViewType) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/** Scrollable co-pilot message stream with reasoning-status pill and scroll anchor. */
export const MessageStream: React.FC<MessageStreamProps> = ({ messages, isProcessing, activeReasoningStep, onSelectCanvas, messagesEndRef }) => (
  <div className="overflow-y-auto space-y-4 pr-1 custom-scrollbar flex-1 mb-4">
    <AnimatePresence initial={false}>
      {messages.map(msg => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
        >
          <div className="flex items-center gap-1.5 mb-1 text-[10px] text-white/40 font-mono">
            <span>{msg.sender === 'user' ? 'Extension Officer' : 'AI Agronomist'}</span>
            <span>•</span>
            <span>{msg.timestamp}</span>
          </div>

          <div
            className={`max-w-[92%] rounded-xl p-4 text-xs leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950/40'
                : 'bg-white/[0.04] border border-white/10 text-white/90 rounded-tl-none space-y-3'
            }`}
          >
            <div className="whitespace-pre-line prose-invert font-sans">
              {msg.text}
            </div>

            {/* Interactive Canvas Pill Trigger in Assistant Message */}
            {msg.canvasTrigger && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => msg.canvasTrigger && onSelectCanvas(msg.canvasTrigger)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xxs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>View {msg.canvasLabel || 'Interactive Canvas'} →</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </AnimatePresence>

    {/* Multi-Step Reasoning Live Badge */}
    {isProcessing && activeReasoningStep && (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2.5 text-xs text-purple-300"
      >
        <Radio className="w-4 h-4 text-purple-400 animate-spin" />
        <span className="font-mono text-xxs font-semibold">{activeReasoningStep}</span>
      </motion.div>
    )}

    <div ref={messagesEndRef} />
  </div>
);
