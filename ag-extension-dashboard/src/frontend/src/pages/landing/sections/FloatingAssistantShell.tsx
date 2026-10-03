import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface FloatingAssistantShellProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

export function FloatingAssistantShell({
  isOpen,
  onOpen,
  onClose,
  className = '',
  children,
}: FloatingAssistantShellProps) {
  const panelId = useId();
  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const launcher = launcherRef.current;
    const focusFrame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      launcher?.focus();
    };
  }, [isOpen, onClose]);

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className={`fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex h-[calc(100dvh-100px-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-lg border border-white/15 bg-slate-950 text-white shadow-2xl shadow-black/50 sm:left-auto sm:right-6 sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:h-[min(640px,calc(100dvh-128px-env(safe-area-inset-bottom)))] ${className}`}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-sm font-semibold">Agronomic Copilot</h2>
                <p className="text-xs text-white/65">GP-Ext</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close agronomic assistant"
                title="Close assistant"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        ref={launcherRef}
        type="button"
        onClick={isOpen ? onClose : onOpen}
        aria-label={isOpen ? 'Minimize agronomic assistant' : 'Open agronomic assistant'}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title={isOpen ? 'Minimize assistant' : 'Ask Agronomic Copilot'}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] flex h-14 items-center justify-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-600 px-4 text-white shadow-lg shadow-black/30 transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden text-sm font-semibold sm:inline">Ask Copilot</span>
      </button>
    </>,
    document.body
  );
}