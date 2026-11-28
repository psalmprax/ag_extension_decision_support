import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, ClipboardCheck, Leaf } from 'lucide-react';
import toast from 'react-hot-toast';
import { alertReviewService, REVIEW_MESSAGE_MAX, type AlertToReview } from '@/api/alertReviewService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { CardHeading } from '@/components/ui/CardHeading';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/ui/controlStyles';

const QUERY_KEY = ['alerts-to-review'];

/** One alert: the facts, a box for the officer's own message, send or dismiss. */
function ReviewItem({ alert }: { alert: AlertToReview }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const done = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const send = useMutation({
    mutationFn: () => alertReviewService.send(alert.id, message.trim()),
    onSuccess: result => {
      toast.success(result.textingOn
        ? t('review_sent', { defaultValue: 'Sent to {n} of your farmers.', n: result.farmers })
        : t('review_saved_texting_off', { defaultValue: 'Saved for {n} of your farmers. Texting farmers is switched off, so it goes out once it is on.', n: result.farmers }));
      void done();
    },
    onError: error => toast.error(getApiErrorMessage(error, t('review_send_failed', { defaultValue: 'The message could not be sent. Try again.' }))),
  });
  const dismiss = useMutation({
    mutationFn: () => alertReviewService.dismiss(alert.id),
    onSuccess: () => void done(),
    onError: error => toast.error(getApiErrorMessage(error, t('review_dismiss_failed', { defaultValue: 'The alert could not be dismissed. Try again.' }))),
  });
  const Icon = alert.type === 'outbreak' ? Bug : Leaf;
  const fieldId = `review-message-${alert.id}`;
  const busy = send.isPending || dismiss.isPending;

  return (
    <li className="py-3 space-y-2">
      <div className="flex gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${alert.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{alert.title}</p>
          {alert.description && <p className="text-xs text-slate-600 dark:text-theme-text-secondary">{alert.description}</p>}
        </div>
      </div>
      <label htmlFor={fieldId} className="block text-xs text-slate-600 dark:text-theme-text-secondary">
        {t('review_message_label', { defaultValue: 'Your message to your {n} farmer(s), after checking', n: alert.my_farmers })}
      </label>
      <textarea
        id={fieldId}
        value={message}
        onChange={event => setMessage(event.target.value)}
        maxLength={REVIEW_MESSAGE_MAX}
        rows={2}
        className="w-full rounded-md border border-slate-900/[0.1] dark:border-white/[0.08] bg-white dark:bg-theme-bg-secondary px-3 py-2 text-sm text-slate-900 dark:text-theme-text-primary"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY_BUTTON} disabled={busy || message.trim().length < 3} onClick={() => send.mutate()}>
          {t('review_send', { defaultValue: 'Send to my farmers' })}
        </button>
        <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => dismiss.mutate()}>
          {t('review_dismiss', { defaultValue: 'Dismiss' })}
        </button>
      </div>
    </li>
  );
}

/**
 * Crop stress seen from space and possible outbreaks, which farmers hear about only after
 * the officer has looked and written to them in their own words.
 */
export function AlertsToReviewCard() {
  const { cardClass } = useThemeClasses();
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: alertReviewService.list, refetchInterval: 15 * 60 * 1000 });

  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <CardHeading
        icon={<ClipboardCheck className="w-[18px] h-[18px] text-primary-500" aria-hidden="true" />}
        title={t('review_title', { defaultValue: 'Alerts to review' })}
        subtitle={t('review_subtitle', { defaultValue: 'Check these before your farmers hear about them' })}
      />
      {isLoading ? (
        <div className="h-20 animate-pulse bg-gray-100 dark:bg-theme-bg-tertiary rounded-xl" role="status" aria-label={t('loading', { defaultValue: 'Loading' })} />
      ) : error ? (
        <p className="text-xs text-slate-500 dark:text-theme-text-muted">{getApiErrorMessage(error, t('review_load_failed', { defaultValue: 'Alerts to review could not be loaded.' }))}</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-theme-text-muted">{t('review_none', { defaultValue: 'Nothing to review. Crop stress seen from space and possible outbreaks near your farmers appear here.' })}</p>
      ) : (
        <ul className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.08] max-h-[28rem] overflow-y-auto">
          {data.map(alert => <ReviewItem key={alert.id} alert={alert} />)}
        </ul>
      )}
    </div>
  );
}
