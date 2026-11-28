import { Ticket } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Input } from '../ui/Input';
import { triggerHaptic } from '@/lib/haptics';

export interface VoucherRedeemProps {
  showVoucherForm: boolean;
  setShowVoucherForm: (show: boolean) => void;
  voucherCode: string;
  setVoucherCode: (code: string) => void;
  handleRedeemVoucher: () => void;
  actionLoading: string | null;
  formMessage: { type: string; text: string } | null;
}

/** Redeem a prepaid voucher code (an NGO or grant code). Needs no payment, so it stays available while billing is off. */
export const VoucherRedeem: React.FC<VoucherRedeemProps> = ({
  showVoucherForm,
  setShowVoucherForm,
  voucherCode,
  setVoucherCode,
  handleRedeemVoucher,
  actionLoading,
  formMessage,
}) => {
  const { t } = useLanguage();

  return (
    <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 hover:border-slate-500/30 transition-all duration-300 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-10 h-10 bg-slate-500/15 border border-slate-500/30 rounded-xl flex items-center justify-center text-slate-700 dark:text-theme-text-muted shadow-inner">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white tracking-tight">
              {t('billing_voucher') || 'AgriVoucher Token'}
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-medium bg-slate-500/10 text-slate-700 dark:text-theme-text-secondary border border-slate-500/20 mt-0.5">
              {t('billing_voucher_desc') || 'Prepaid NGO / Grant Code'}
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('light');
            setShowVoucherForm(!showVoucherForm);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-slate-500/15 border border-slate-500/30 text-slate-700 dark:text-theme-text-secondary hover:bg-slate-600 hover:text-white text-xs font-medium transition-all"
        >
          {showVoucherForm ? 'Hide' : t('action_redeem') || 'Redeem'}
        </button>
      </div>
      {showVoucherForm && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 space-y-3 relative z-10">
          <Input
            type="text"
            value={voucherCode}
            onChange={e => setVoucherCode(e.target.value.toUpperCase())}
            placeholder="Enter voucher code (e.g. AGV-A1B2C3D4)"
            className="font-mono text-xs bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl"
          />
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500 dark:text-white/50">{t('ui_payment_methods_instantly_unlocks_agronomist_quota')}</p>
            <button
              disabled={!voucherCode.trim() || actionLoading === 'voucher'}
              onClick={() => {
                triggerHaptic('medium');
                handleRedeemVoucher();
              }}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-medium text-xs rounded-lg shadow-sm transition-all shrink-0"
            >
              {t('ui_payment_methods_activate_token')}
            </button>
          </div>
          {formMessage && (
            <p
              className={`text-xs font-medium ${formMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}
            >
              {formMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
