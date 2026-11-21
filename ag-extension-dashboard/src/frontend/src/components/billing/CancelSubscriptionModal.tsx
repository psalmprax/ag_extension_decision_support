import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BaseModal } from '../BaseModal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { triggerHaptic } from '@/lib/haptics';
import { useLanguage } from '@/lib/LanguageContext';

const CANCELLATION_REASON_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using_enough', label: 'Not using it enough' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'switching_service', label: 'Switching to another service' },
  { value: 'poor_support', label: 'Poor support' },
  { value: 'seasonal_pause', label: 'Seasonal pause' },
  { value: 'other', label: 'Other' },
] as const;

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string, comment?: string) => Promise<boolean>;
  loading: boolean;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
}) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');

  const reset = () => {
    setReason('');
    setComment('');
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    triggerHaptic('medium');
    const done = await onConfirm(reason || undefined, comment || undefined);
    if (done) reset();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cancel subscription"
      subtitle="Access continues until the end of the paid period"
      icon={<AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300" />}
      iconBg="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={loading} className="flex-1">
            {t('ui_cancel_subscription_modal_keep_subscription')}
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              void handleSubmit();
            }}
            className="flex-1"
          >
            {t('ui_billing_dashboard_cancel_subscription')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-white/70 leading-relaxed">
          {t('ui_cancel_subscription_modal_your_plan_stays_active_until_the_cur')}
        </p>

        <div className="space-y-2">
          <label
            htmlFor="cancellation-reason"
            className="text-xxs font-bold text-slate-600 dark:text-white/60 block ms-1"
          >
            {t('ui_cancel_subscription_modal_reason_optional')}
          </label>
          <Select
            id="cancellation-reason"
            options={[...CANCELLATION_REASON_OPTIONS]}
            value={reason}
            onChange={event => setReason(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cancellation-comment"
            className="text-xxs font-bold text-slate-600 dark:text-white/60 block ms-1"
          >
            {t('ui_cancel_subscription_modal_anything_else_optional')}
          </label>
          <Textarea
            id="cancellation-comment"
            rows={3}
            maxLength={1000}
            placeholder="What would have made the platform worth keeping?"
            value={comment}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setComment(event.target.value)}
            disabled={loading || !reason}
          />
          {!reason && (
            <p className="text-xxs text-slate-500 dark:text-white/40 ms-1">
              {t('ui_cancel_subscription_modal_select_a_reason_before_adding_an_opt')}
            </p>
          )}
          <p className="text-xxs text-slate-500 dark:text-white/40 ms-1">{comment.length}/1000</p>
        </div>
      </div>
    </BaseModal>
  );
};
