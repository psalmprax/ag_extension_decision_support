import React from 'react';
import { Footprints, MousePointerClick, Play, Square, Undo2, X } from 'lucide-react';
import type { BoundaryPoint } from '@ag-extension/shared/api';
import { Dialog, DialogTitle } from '@/components/ui/Dialog';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TAB_ROW, tabButtonClass } from '@/components/ui/controlStyles';
import { useLanguage } from '@/lib/LanguageContext';
import { BoundaryMap } from './BoundaryMap';
import { BoundaryNote, BoundaryStats } from './BoundaryEditorParts';
import { summarizeBoundary, type FieldBoundary } from './boundaryModel';
import { useBoundaryDraft } from './useBoundaryDraft';
import { GpsMessage } from './BoundaryEditorParts';

interface FieldBoundaryEditorProps {
  initial: FieldBoundary | null;
  /** The field's saved location, to open the map on it. */
  center: BoundaryPoint | null;
  onClose: () => void;
  onSave: (boundary: FieldBoundary) => void;
}

/**
 * Maps a field's edge, either by walking it with the phone (a point is added every few metres
 * of good GPS) or by tapping its corners on satellite imagery. The area comes from the shape,
 * with how far off it could be. Render it only while open, so each opening starts from `initial`.
 */
export const FieldBoundaryEditor: React.FC<FieldBoundaryEditorProps> = ({ initial, center, onClose, onSave }) => {
  const { t } = useLanguage();
  const editor = useBoundaryDraft(initial);
  const { draft, walking } = editor;
  const boundary = editor.boundary();
  const summary = summarizeBoundary(boundary);
  const close = () => {
    if (walking) editor.stopWalking();
    onClose();
  };

  return (
    <Dialog open onClose={close} size="3xl">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle>{t('boundary_title', { defaultValue: 'Map the field boundary' })}</DialogTitle>
            <p className="mt-1 text-sm text-slate-600 dark:text-theme-text-secondary">
              {draft.method === 'walked'
                ? t('boundary_walk_help', { defaultValue: 'Start at a corner and walk all the way round the edge with this phone. A point is added every few metres; poor GPS fixes are skipped.' })
                : t('boundary_draw_help', { defaultValue: 'Tap each corner of the field on the satellite map, in order round the edge.' })}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={t('common_close', { defaultValue: 'Close' })} className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]">
            <X className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className={TAB_ROW} role="group" aria-label={t('boundary_method', { defaultValue: 'How to map it' })}>
          <button type="button" aria-pressed={draft.method === 'walked'} disabled={walking} onClick={() => editor.setMethod('walked')} className={tabButtonClass(draft.method === 'walked')}>
            <Footprints className="w-4 h-4" aria-hidden="true" />
            {t('boundary_method_walk', { defaultValue: 'Walk the edge' })}
          </button>
          <button type="button" aria-pressed={draft.method === 'drawn'} disabled={walking} onClick={() => editor.setMethod('drawn')} className={tabButtonClass(draft.method === 'drawn')}>
            <MousePointerClick className="w-4 h-4" aria-hidden="true" />
            {t('boundary_method_draw', { defaultValue: 'Tap corners on the map' })}
          </button>
        </div>

        <BoundaryMap
          points={draft.points}
          center={center}
          onTap={draft.method === 'drawn' ? editor.tap : undefined}
          fix={walking ? draft.lastFix : null}
          label={t('boundary_map_label', { defaultValue: 'Satellite map of the field' })}
        />

        <div className="flex flex-wrap items-center gap-2">
          {draft.method === 'walked' &&
            (walking ? (
              <button type="button" onClick={editor.stopWalking} className={PRIMARY_BUTTON}>
                <Square className="w-4 h-4" aria-hidden="true" />
                {t('boundary_stop_walking', { defaultValue: 'Finish walking' })}
              </button>
            ) : (
              <button type="button" onClick={editor.startWalking} className={PRIMARY_BUTTON}>
                <Play className="w-4 h-4" aria-hidden="true" />
                {draft.points.length ? t('boundary_walk_again', { defaultValue: 'Walk it again' }) : t('boundary_start_walking', { defaultValue: 'Start walking' })}
              </button>
            ))}
          <button type="button" onClick={editor.undo} disabled={draft.points.length === 0 || walking} className={SECONDARY_BUTTON}>
            <Undo2 className="w-4 h-4" aria-hidden="true" />
            {t('boundary_undo', { defaultValue: 'Undo last point' })}
          </button>
          <button type="button" onClick={editor.clear} disabled={draft.points.length === 0} className={SECONDARY_BUTTON}>
            {t('boundary_clear', { defaultValue: 'Clear' })}
          </button>
          {walking && draft.lastFix && (
            <span className="text-sm text-slate-600 dark:text-theme-text-secondary tabular-nums" aria-live="polite">
              {t('boundary_live_fix', { defaultValue: 'GPS ±{metres} m', metres: Math.round(draft.lastFix.accuracy) })}
            </span>
          )}
        </div>

        <GpsMessage gps={draft.gps} signalLost={walking && draft.signalLost} skipped={walking && draft.lastFix?.verdict === 'too_inaccurate' ? draft.lastFix.accuracy : null} />

        <BoundaryStats boundary={boundary} summary={summary} pointCount={draft.points.length} />
        <BoundaryNote summary={summary} boundary={boundary} />

        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" disabled={walking || summary.problem !== null} onClick={() => onSave(boundary)} className={PRIMARY_BUTTON}>
            {t('boundary_use', { defaultValue: 'Use this boundary' })}
          </button>
          <button type="button" onClick={close} className={SECONDARY_BUTTON}>
            {t('common_cancel', { defaultValue: 'Cancel' })}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
