import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useLanguage } from '@/lib/LanguageContext';

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
  const { t } = useLanguage();
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
            className={`fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col overflow-hidden rounded-lg border border-white/15 bg-[#0d1a14] text-white shadow-2xl shadow-black/50 sm:top-auto sm:inset-x-auto sm:end-6 sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:w-[420px] sm:h-[min(640px,calc(100dvh-128px-env(safe-area-inset-bottom)))] ${className}`}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-sm font-medium">{t('ui_floating_assistant_shell_agronomic_copilot')}</h2>
                <p className="text-xs text-white/65">{t('ui_floating_assistant_shell_gp_ext')}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('assistant_close', { defaultValue: 'Close the assistant' })}
                title={t('assistant_close', { defaultValue: 'Close the assistant' })}
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
        aria-label={isOpen ? t('assistant_minimize', { defaultValue: 'Minimize the assistant' }) : t('assistant_open', { defaultValue: 'Open the assistant' })}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title={isOpen ? t('assistant_minimize', { defaultValue: 'Minimize the assistant' }) : t('assistant_open', { defaultValue: 'Open the assistant' })}
        className="fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] flex h-14 items-center justify-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-600 px-4 text-white shadow-lg shadow-black/30 transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:end-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden text-sm font-medium sm:inline">{t('ui_floating_assistant_shell_ask_copilot')}</span>
      </button>
    </>,
    document.body
  );
}