import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { BaseModal } from '../BaseModal';
import { triggerHaptic } from '@/lib/haptics';
import {
  STANDARD_REASON_CODES,
  StandardReasonCode,
  AuditReasonModalProps,
} from './auditReasonTypes';

export const AuditReasonModal: React.FC<AuditReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  actionDescription,
  resourceName,
  confirmText = 'Authorize & Execute Action',
  isLoading = false,
}) => {
  const [selectedCode, setSelectedCode] = useState<StandardReasonCode>('SUSPECTED_ACCOUNT_COMPROMISE');
  const [customCode, setCustomCode] = useState('');
  const [justification, setJustification] = useState('');
  const [hasConfirmedPolicy, setHasConfirmedPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = selectedCode === 'CUSTOM';
  const effectiveCode = isCustom ? customCode.trim() : selectedCode;
  const isJustificationValid = justification.trim().length >= 10;
  const isCodeValid = effectiveCode.length > 0;
  const canSubmit = isCodeValid && isJustificationValid && hasConfirmedPolicy && !isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!isCodeValid) {
        setError('Please specify a valid audit reason code.');
      } else if (!isJustificationValid) {
        setError('Please provide an operational justification of at least 10 characters.');
      } else if (!hasConfirmedPolicy) {
        setError('You must acknowledge that this high-privilege action is logged and auditable.');
      }
      return;
    }

    triggerHaptic('heavy');
    setError(null);
    onConfirm({
      reasonCode: effectiveCode,
      justification: justification.trim(),
    });
  };

  const handleClose = () => {
    if (isLoading) return;
    setError(null);
    setJustification('');
    setCustomCode('');
    setHasConfirmedPolicy(false);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Non-Repudiation Security Authorization"
      subtitle="Privileged operations require an immutable audit trail entry"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-200">
              High-Impact Administrative Action: <span className="text-white font-mono">{actionTitle}</span>
            </p>
            {resourceName && (
              <p className="text-amber-300/80 font-mono text-[11px]">Target: {resourceName}</p>
            )}
            {actionDescription && <p className="text-amber-200/70">{actionDescription}</p>}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center gap-2 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Reason Code Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor="audit-reason-code" className="block text-xs font-semibold text-white/90">
            Audit Reason Code <span className="text-rose-400">*</span>
          </label>
          <select
            id="audit-reason-code"
            value={selectedCode}
            onChange={e => {
              setSelectedCode(e.target.value as StandardReasonCode);
              setError(null);
            }}
            disabled={isLoading}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-sans"
          >
            {STANDARD_REASON_CODES.map(rc => (
              <option key={rc.code} value={rc.code} className="bg-slate-900 text-white py-1">
                {rc.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/50">
            {STANDARD_REASON_CODES.find(rc => rc.code === selectedCode)?.description}
          </p>
        </div>

        {/* Custom Reason Code Input (conditional) */}
        {isCustom && (
          <div className="space-y-1.5 animate-fadeIn">
            <label htmlFor="audit-custom-code" className="block text-xs font-semibold text-white/90">
              Custom Reason Code / Ticket # <span className="text-rose-400">*</span>
            </label>
            <input
              id="audit-custom-code"
              type="text"
              placeholder="e.g. SEC-INCIDENT-2026-0812 or JIRA-AG-4912"
              value={customCode}
              onChange={e => {
                setCustomCode(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
              maxLength={64}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/40 text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
            />
          </div>
        )}

        {/* Justification Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="audit-justification" className="block text-xs font-semibold text-white/90">
              Technical Justification & Context <span className="text-rose-400">*</span>
            </label>
            <span
              className={`text-[11px] ${
                isJustificationValid ? 'text-emerald-400' : 'text-white/40'
              }`}
            >
              {justification.trim().length}/10 min chars
            </span>
          </div>
          <textarea
            id="audit-justification"
            rows={3}
            placeholder="Explain the specific root cause, legal obligation, or operational context requiring this action..."
            value={justification}
            onChange={e => {
              setJustification(e.target.value);
              setError(null);
            }}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none"
          />
        </div>

        {/* Policy Certification Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
          <input
            type="checkbox"
            checked={hasConfirmedPolicy}
            onChange={e => {
              setHasConfirmedPolicy(e.target.checked);
              setError(null);
            }}
            disabled={isLoading}
            className="mt-0.5 rounded border-white/20 text-amber-500 focus:ring-amber-400/40 bg-slate-900"
          />
          <span className="text-xs text-white/80 select-none">
            I certify under the Agronomic Security Governance Policy that this privileged operation is
            duly authorized and directly tied to the specified audit justification.
          </span>
        </label>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition-all disabled:opacity-40 disabled:hover:bg-amber-600 shadow-lg shadow-amber-600/20 flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
