import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiClient from '@/api/client';
import { fetchPlanQuotas, type PlanQuotas } from '@/api/billingService';
import { useLanguage } from '@/lib/LanguageContext';
import { USER_ROLES, type DirectoryUser } from '@/components/users/types';

interface UserAccessModalProps {
  user: DirectoryUser | null;
  currentUserId?: string;
  isDemo: boolean;
  onClose: () => void;
}

export function UserAccessModal({ user, currentUserId, isDemo, onClose }: UserAccessModalProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [role, setRole] = useState(user?.role || 'extension_officer');
  const [planId, setPlanId] = useState(user?.planId || '');
  const [isActive, setIsActive] = useState(user?.isActive !== false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user) {
      setRole(user.role || 'extension_officer');
      setPlanId(user.planId || '');
      setIsActive(user.isActive !== false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [user]);

  const { data: quotasResp, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plan-quotas'],
    queryFn: fetchPlanQuotas,
    enabled: Boolean(user) && !isDemo,
  });

  const plans: PlanQuotas[] = Array.isArray(quotasResp?.data) ? quotasResp.data : [];

  const updateAccess = useMutation({
    mutationFn: async () => {
      if (!user) return null;
      if (isDemo) {
        return { success: true };
      }
      const payload: Record<string, unknown> = {
        role,
        isActive,
      };
      if (planId) {
        payload.planId = planId;
      }
      const res = await apiClient.put(`/users/${user.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setErrorMsg('');
      setSuccessMsg(t('users_access_updated', 'Access level and subscription tier updated.'));
      setTimeout(() => {
        onClose();
      }, 600);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(
        e?.response?.data?.error ||
          e?.message ||
          t('users_access_update_failed', 'Failed to update user access')
      );
    },
  });

  if (!user) return null;

  const isEditingSelf = Boolean(currentUserId && user.id === currentUserId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    updateAccess.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-access-modal-title"
    >
      <div
        className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 text-white"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="user-access-modal-title" className="text-base font-bold">
                {t('users_access_modal_title', 'Manage Access & Subscription')}
              </h2>
              <p className="text-xs text-white/60">
                {user.firstName} {user.lastName} • {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
            aria-label={t('common_close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="access-role-select" className="text-xs font-medium text-white/70">
              {t('users_form_role', 'System Role')}
            </label>
            <select
              id="access-role-select"
              value={role}
              disabled={isEditingSelf}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
            >
              {USER_ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey, r.label)}
                </option>
              ))}
            </select>
            {isEditingSelf && (
              <p className="text-[11px] text-white/50">
                {t('users_access_self_role_note', 'Admins cannot demote their own active role.')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="access-plan-select" className="text-xs font-medium text-white/70">
              {t('users_access_plan_label', 'Subscription Tier (Feature Access)')}
            </label>
            <select
              id="access-plan-select"
              value={planId}
              disabled={isLoadingPlans || role === 'admin'}
              onChange={e => setPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
            >
              <option value="">
                {role === 'admin'
                  ? t('users_access_admin_full', 'Admin — Full Platform Access')
                  : t('users_access_keep_plan', 'Current: {plan} (unchanged)', { plan: user.planName || 'Free' })}
              </option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.currency} {plan.price}/{plan.interval})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-white/50">
              {role === 'admin'
                ? t('users_access_admin_bypass_note', 'Admin accounts bypass subscription tier restrictions automatically.')
                : t('users_access_plan_hint', 'Pro & Enterprise unlock AI Chat, Visits, Spatial Intelligence, SMS, Diagnostics, and Analytics.')}
            </p>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer">
            <div>
              <div className="text-xs font-medium text-white">
                {t('users_access_account_active', 'Account Active')}
              </div>
              <div className="text-[11px] text-white/50">
                {t('users_access_account_active_hint', 'Suspended accounts are immediately signed out and blocked.')}
              </div>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              disabled={isEditingSelf}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-50"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              {t('common_cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={updateAccess.isPending}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {updateAccess.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('users_access_save', 'Save Access')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
