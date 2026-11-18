import { useEffect, useRef, useState } from 'react';
import { Dialog as HeadlessDialog } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiClient from '@/api/client';
import { fetchPlanQuotas, type PlanQuotas } from '@/api/billingService';
import { useLanguage } from '@/lib/LanguageContext';
import { USER_ROLES, type DirectoryUser } from '@/components/users/types';
import { PlanTierSelector } from '@/components/users/PlanTierSelector';

interface UserAccessModalProps {
  user: DirectoryUser | null;
  currentUserId?: string;
  isDemo: boolean;
  onClose: () => void;
}

interface AccessMutationVars {
  sessionId: number;
  userId: string;
  payload: Record<string, unknown>;
}

export function UserAccessModal({ user, currentUserId, isDemo, onClose }: UserAccessModalProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const initialRole = user?.role || 'extension_officer';
  const initialIsActive = user?.isActive !== false;

  const [role, setRole] = useState(initialRole);
  // Default to '' ("keep unchanged") so role/status saves never resend planId and reset usage/periods.
  const [planId, setPlanId] = useState('');
  const [isActive, setIsActive] = useState(initialIsActive);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const sessionIdRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updateAccess = useMutation({
    mutationFn: async ({ userId, payload }: AccessMutationVars) => {
      if (isDemo) {
        return { success: true };
      }
      const res = await apiClient.put(`/users/${userId}`, payload);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (vars.sessionId !== sessionIdRef.current) return;
      setErrorMsg('');
      setSuccessMsg(t('users_access_updated', 'Access level and subscription tier updated.'));
      clearCloseTimer();
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        if (vars.sessionId === sessionIdRef.current) {
          onClose();
        }
      }, 600);
    },
    onError: (err: unknown, vars) => {
      if (vars.sessionId !== sessionIdRef.current) return;
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrorMsg(
        e?.response?.data?.error ||
          e?.message ||
          t('users_access_update_failed', 'Failed to update user access')
      );
    },
  });

  const { reset: resetMutation } = updateAccess;

  useEffect(() => {
    sessionIdRef.current += 1;
    clearCloseTimer();
    resetMutation();
    if (user) {
      setRole(user.role || 'extension_officer');
      setPlanId('');
      setIsActive(user.isActive !== false);
      setErrorMsg('');
      setSuccessMsg('');
    }
    return () => {
      sessionIdRef.current += 1;
      clearCloseTimer();
    };
  }, [user, resetMutation]);

  const {
    data: quotasResp,
    isLoading: isLoadingPlans,
    isError: isQuotasQueryError,
    isFetching: isFetchingPlans,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ['plan-quotas'],
    queryFn: fetchPlanQuotas,
    enabled: Boolean(user) && !isDemo,
  });

  if (!user) return null;

  const plansLoadFailed =
    !isDemo &&
    !isLoadingPlans &&
    (isQuotasQueryError || (quotasResp !== undefined && quotasResp.success === false));
  const plansErrorMessage =
    quotasResp?.error || t('users_access_plans_load_error', 'Unable to load subscription plans.');
  const plans: PlanQuotas[] =
    quotasResp?.success === true && Array.isArray(quotasResp.data) ? quotasResp.data : [];

  const isEditingSelf = Boolean(currentUserId && user.id === currentUserId);

  const changePayload: Record<string, unknown> = {};
  if (role !== initialRole) changePayload.role = role;
  if (isActive !== initialIsActive) changePayload.isActive = isActive;
  if (planId && role !== 'admin') changePayload.planId = planId;
  const hasChanges = Object.keys(changePayload).length > 0;

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    if (nextRole === 'admin') setPlanId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || updateAccess.isPending || Boolean(successMsg)) return;
    setErrorMsg('');
    setSuccessMsg('');
    updateAccess.mutate({
      sessionId: sessionIdRef.current,
      userId: user.id,
      payload: changePayload,
    });
  };

  return (
    <HeadlessDialog open={Boolean(user)} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <HeadlessDialog.Panel className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 text-white">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <HeadlessDialog.Title as="h2" id="user-access-modal-title" className="text-base font-bold">
                  {t('users_access_modal_title', 'Manage Access & Subscription')}
                </HeadlessDialog.Title>
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
                onChange={e => handleRoleChange(e.target.value)}
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

            <PlanTierSelector
              planId={planId}
              currentPlanName={user.planName}
              role={role}
              isDemo={isDemo}
              isLoadingPlans={isLoadingPlans}
              isFetchingPlans={isFetchingPlans}
              plansLoadFailed={plansLoadFailed}
              plansErrorMessage={plansErrorMessage}
              plans={plans}
              onChangePlanId={setPlanId}
              onRetry={() => void refetchPlans()}
            />

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
                disabled={updateAccess.isPending || !hasChanges || Boolean(successMsg)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {updateAccess.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t('users_access_save', 'Save Access')}</span>
              </button>
            </div>
          </form>
        </HeadlessDialog.Panel>
      </div>
    </HeadlessDialog>
  );
}
