import { useState } from 'react';
import { isAxiosError } from 'axios';
import { FileText, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { draftGoalCampaign, executeGoalCampaign, type CampaignTarget, type GoalCampaignResult } from '@/api/campaignService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';

/** Same limit as the server: a few SMS parts. */
const MESSAGE_MAX = 600;

interface CampaignLaunchProps {
  target: CampaignTarget;
  channel: 'all' | 'sms' | 'whatsapp' | 'telegram';
  autoScheduleVisits: boolean;
  onBusy: (busy: boolean) => void;
  onSent: (result: GoalCampaignResult) => void;
}

interface Draft {
  text: string;
  farmers: number;
  violations: string[];
}

const rejectedViolations = (error: unknown): string[] =>
  (isAxiosError(error) && Array.isArray(error.response?.data?.violations) ? error.response.data.violations : []);

/**
 * A campaign in two steps: the AI drafts a message and counts who would get it; the officer reads
 * and edits it, and only then sends. The server refuses a message with a rate, dose or waiting
 * period, and says so here.
 */
export function CampaignLaunch({ target, channel, autoScheduleVisits, onBusy, onSent }: CampaignLaunchProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState<'draft' | 'send' | null>(null);

  const run = async (step: 'draft' | 'send', action: () => Promise<void>) => {
    setWorking(step);
    onBusy(true);
    try {
      await action();
    } finally {
      setWorking(null);
      onBusy(false);
    }
  };

  const writeDraft = () => run('draft', async () => {
    if (!target.goalPrompt.trim()) {
      toast.error(t('campaign_needs_goal', { defaultValue: 'Say what the campaign is for first.' }));
      return;
    }
    try {
      const result = await draftGoalCampaign(target);
      setDraft({ text: result.draftText, farmers: result.affectedFarmersCount, violations: result.violations });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('campaign_draft_failed', { defaultValue: 'The draft could not be written. Try again.' })));
    }
  });

  const send = (current: Draft) => run('send', async () => {
    try {
      const result = await executeGoalCampaign({ ...target, channel, autoScheduleVisits, message: current.text });
      setDraft(null);
      onSent(result);
    } catch (error) {
      setDraft({ ...current, violations: rejectedViolations(error) });
      toast.error(getApiErrorMessage(error, t('campaign_send_failed', { defaultValue: 'The campaign could not be sent. Try again.' })));
    }
  });

  if (!draft) {
    return (
      <button
        type="button"
        onClick={() => void writeDraft()}
        disabled={working !== null}
        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        {working ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FileText className="w-4 h-4" aria-hidden="true" />}
        <span>{working ? t('campaign_drafting', { defaultValue: 'Writing a draft…' }) : t('campaign_write_draft', { defaultValue: 'Write a draft to check' })}</span>
      </button>
    );
  }

  const tooLong = draft.text.length > MESSAGE_MAX;
  return (
    <div className="w-full space-y-2 pt-2">
      <label htmlFor="campaign-message" className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
        {t('campaign_review_label', { defaultValue: 'Read and edit before it goes to {count} farmers', count: draft.farmers })}
      </label>
      <textarea
        id="campaign-message"
        value={draft.text}
        onChange={e => setDraft({ ...draft, text: e.target.value, violations: [] })}
        rows={5}
        placeholder={t('campaign_write_yourself', { defaultValue: 'The AI wrote no draft. Write the message yourself.' })}
        className="w-full rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-theme-bg-primary p-2 text-sm text-slate-900 dark:text-theme-text-primary"
      />
      <p className={`text-xxs tabular-nums ${tooLong ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-theme-text-muted'}`}>
        {draft.text.length} / {MESSAGE_MAX}
      </p>
      {draft.violations.length > 0 && (
        <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
          {t('campaign_has_rate', { defaultValue: 'This gives a rate, dose or waiting period, which a campaign cannot carry. Remove it and tell farmers to ask their officer, who checks the label.' })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setDraft(null)} disabled={working !== null} className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-theme-text-secondary hover:bg-slate-100 dark:hover:bg-white/5">
          {t('campaign_discard', { defaultValue: 'Discard' })}
        </button>
        <button
          type="button"
          onClick={() => void send(draft)}
          disabled={working !== null || draft.farmers === 0 || !draft.text.trim() || tooLong || draft.violations.length > 0}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {working === 'send' ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
          {t('campaign_send_to', { defaultValue: 'Send to {count} farmers', count: draft.farmers })}
        </button>
      </div>
    </div>
  );
}
