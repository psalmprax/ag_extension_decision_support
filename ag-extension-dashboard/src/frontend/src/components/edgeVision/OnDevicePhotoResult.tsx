import { CloudOff, Loader2, ShieldAlert, Smartphone } from 'lucide-react';
import type { EdgeDiagnosisCandidate, OfflineDiagnosisResult } from '@/services/edgePlantVisionClassifier';
import { useLanguage } from '@/lib/LanguageContext';

/** Why the phone's answer is the one on screen. */
export type OnDeviceReason = 'sure' | 'offline' | 'online-failed';

const percent = (share: number) => Math.round(share * 100);

function AnswerLine({ candidate }: { candidate: EdgeDiagnosisCandidate }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-slate-900 dark:text-theme-text-primary">{candidate.condition}</span>
      <span className="text-xs text-slate-500 dark:text-theme-text-muted tabular-nums shrink-0">{percent(candidate.confidence)}%</span>
    </div>
  );
}

/**
 * The photo check's answer from the disease model on this phone: the top answer, up to two
 * alternatives, why no online check ran, and a way to ask for one. Treatment advice is not shown.
 */
export function OnDevicePhotoResult({ result, reason, onCloudCheck, cloudBusy = false }: {
  result: OfflineDiagnosisResult;
  reason: OnDeviceReason;
  onCloudCheck?: () => void;
  cloudBusy?: boolean;
}) {
  const { t } = useLanguage();
  const top = result.primaryDiagnosis;
  const why = {
    sure: t('on_device_reason_sure', { defaultValue: 'The model on this phone was sure enough, so the photo was not sent for the online check.' }),
    offline: t('on_device_reason_offline', { defaultValue: 'No connection. The photo is queued for the online check.' }),
    'online-failed': t('on_device_reason_online_failed', { defaultValue: 'The online check could not run, so this is the answer from the model on this phone.' }),
  }[reason];

  return (
    <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-4">
      <div className="flex items-start gap-2">
        <Smartphone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
            {t('on_device_title', { defaultValue: 'Checked on this phone' })}
          </h4>
          <p className="text-xs text-slate-500 dark:text-theme-text-muted">{result.modelVersion}</p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
        <p className="text-xs text-slate-500 dark:text-theme-text-muted">
          {top.healthy
            ? t('on_device_top_healthy', { defaultValue: 'Most likely: no disease seen' })
            : t('on_device_top', { defaultValue: 'Most likely' })}
        </p>
        <AnswerLine candidate={top} />
        {result.alternatives.length > 0 && (
          <>
            <p className="pt-1 text-xs text-slate-500 dark:text-theme-text-muted">{t('on_device_alternatives', { defaultValue: 'Also possible' })}</p>
            {result.alternatives.map(candidate => <AnswerLine key={candidate.modelLabel ?? candidate.condition} candidate={candidate} />)}
          </>
        )}
      </div>

      <p className="text-xs text-slate-700 dark:text-theme-text-secondary">{why}</p>
      <p className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          {t('on_device_unconfirmed', { defaultValue: 'Not confirmed. Treatment advice is held back until an extension officer confirms the diagnosis.' })}{' '}
          {result.heuristicDisclaimer}
        </span>
      </p>

      {reason === 'offline' ? (
        <p className="text-xs text-slate-500 dark:text-theme-text-muted flex items-center gap-2">
          <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
          {t('on_device_queued', { defaultValue: 'Queued for the online check' })}
        </p>
      ) : onCloudCheck && (
        <button
          type="button"
          onClick={onCloudCheck}
          disabled={cloudBusy}
          className="w-full py-2 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] text-xs font-medium text-slate-900 dark:text-theme-text-primary hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {cloudBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          {t('on_device_check_online', { defaultValue: 'Check with the online model' })}
        </button>
      )}
    </div>
  );
}
