import React, { useId, useState } from 'react';
import { ChevronDown, Smartphone } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { safeStorage } from '@/lib/safeStorage';
import { cn } from '@/lib/cn';
import { PhoneSimulator } from './PhoneSimulator';
import type { WorkflowStep } from './studioModel';

/** Remembers, per browser, whether the person closed the preview. */
export const PREVIEW_OPEN_KEY = 'advisory-studio-preview-open';

/**
 * The phone preview beside the protocol canvas. It folds away to give the canvas room: on a
 * wide screen to a narrow strip at the side, on a narrow one to its heading. The choice is
 * remembered in this browser, and the phone keeps its state while folded.
 */
export function PhonePreviewPanel({ steps }: { steps: WorkflowStep[] }) {
  const { t } = useLanguage();
  const bodyId = useId();
  const [open, setOpen] = useState(() => safeStorage.get(PREVIEW_OPEN_KEY) !== 'false');
  const title = t('ui_advisory_studio_page_mobile_pwa_preview');

  const toggle = () => {
    const next = !open;
    setOpen(next);
    safeStorage.set(PREVIEW_OPEN_KEY, String(next));
  };

  return (
    <aside
      aria-label={title}
      className={cn(
        'w-full border-t lg:border-t-0 lg:border-s border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] flex flex-col items-center shrink-0 lg:overflow-y-auto',
        open ? 'p-4 sm:p-5 lg:w-80' : 'px-4 py-3 sm:px-5 lg:w-12 lg:px-2 lg:py-4',
      )}
    >
      <div className={cn('w-full flex items-center justify-between gap-2', open && 'mb-4')}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          title={title}
          className={cn(
            'flex items-center gap-1.5 rounded-md p-1 -m-1 text-xs font-medium text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-theme-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500',
            !open && 'lg:flex-col lg:mx-auto',
          )}
        >
          <Smartphone className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className={cn(!open && 'lg:sr-only')}>{title}</span>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {open && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-theme-text-secondary border border-slate-900/[0.08] dark:border-white/[0.08]">
            {t('ui_advisory_studio_page_offline_ready')}
          </span>
        )}
      </div>

      {/* Hidden, not unmounted: folding keeps what the person set on the phone (crop,
          severity, soil pH, a submitted reading). */}
      <div id={bodyId} hidden={!open} className={cn('w-full flex-col items-center', open && 'flex')}>
        <PhoneSimulator steps={steps} />
        <div className="mt-4 w-full p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-500 dark:text-theme-text-muted text-xs text-center">
          {t('ui_advisory_studio_page_rule_updates_on_canvas_reflect_immed')}
        </div>
      </div>
    </aside>
  );
}
