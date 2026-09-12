import React, { useState } from 'react';
import { ShieldAlert, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { BaseModal } from '../BaseModal';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { triggerHaptic } from '@/lib/haptics';

// fallow-ignore-next-line unused-type
export interface AuditContext {
  reasonCode: string;
  justification: string;
}

// fallow-ignore-next-line unused-export
export const STANDARD_REASON_CODES = [
  {
    code: 'SUSPECTED_ACCOUNT_COMPROMISE',
    label: '🚨 Suspected Account Compromise / Intrusion',
    description: 'Emergency lockdown or credential revocation due to anomalous activity.',
  },
  {
    code: 'COMPLIANCE_GDPR_ERASURE',
    label: '⚖️ GDPR / Data Subject Erasure Request',
    description: 'Verified Right to Erasure or privacy compliance obligation.',
  },
  {
    code: 'FARMER_RECORD_DISPUTE',
    label: '🌾 Farmer Record Dispute / Boundary Correction',
    description: 'Rectifying contested land parcels, crops, or contact information.',
  },
  {
    code: 'DATA_INTEGRITY_CORRECTION',
    label: '🔧 Data Integrity / Telemetry Calibration',
    description: 'Fixing corrupted telemetry, sensor anomalies, or duplicate profiles.',
  },
  {
    code: 'OFFICER_OFFBOARDING',
    label: '👤 Officer Offboarding / Access Deprovisioning',
    description: 'Deprovisioning accounts or reassigning portfolio farmers.',
  },
  {
    code: 'EMERGENCY_FIELD_TRIAGE',
    label: '⚡ Emergency Agronomic Intervention',
    description: 'Critical pest outbreak containment or weather crisis override.',
  },
  {
    code: 'ROUTINE_SYSTEM_MAINTENANCE',
    label: '🛠️ Scheduled System Maintenance',
    description: 'Routine verified administrative housekeeping or database hygiene.',
  },
  {
    code: 'CUSTOM',
    label: '✏️ Custom Reason Code (Specify below)...',
    description: 'Enter a custom tracking ticket or specific governance code.',
  },
] as const;

// fallow-ignore-next-line unused-type
export type StandardReasonCode = (typeof STANDARD_REASON_CODES)[number]['code'];

// fallow-ignore-next-line unused-type
export interface AuditReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (audit: AuditContext) => void;
  actionTitle: string;
  actionDescription?: string;
  resourceName?: string;
  confirmText?: string;
  isLoading?: boolean;
}

// fallow-ignore-next-line unused-export
export const getAuditHeaders = (reasonCode: string, justification: string): Record<string, string> => ({
  'X-Audit-Reason-Code': reasonCode,
  'X-Audit-Justification': justification,
});

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
  const { radiusClass } = useThemeClasses();
  const [selectedCode, setSelectedCode] = useState<string>(STANDARD_REASON_CODES[0].code);
  const [customCode, setCustomCode] = useState('');
  const [justification, setJustification] = useState('');
  const [certified, setCertified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveReasonCode = selectedCode === 'CUSTOM' ? customCode.trim().toUpperCase() : selectedCode;
  const isJustificationValid = justification.trim().length >= 10;
  const isReasonCodeValid = selectedCode !== 'CUSTOM' || effectiveReasonCode.length >= 3;
  const canSubmit = isJustificationValid && isReasonCodeValid && certified && !isLoading;

  const handleConfirm = () => {
    if (!isReasonCodeValid) {
      setError('Please provide a valid custom reason code (e.g. TICKET-1049).');
      return;
    }
    if (!isJustificationValid) {
      setError('Justification must be at least 10 characters explaining why this action is required.');
      return;
    }
    if (!certified) {
      setError('You must certify policy compliance before continuing.');
      return;
    }

    triggerHaptic('medium');
    setError(null);
    onConfirm({
      reasonCode: effectiveReasonCode,
      justification: justification.trim(),
    });
  };

  const footer = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
        disabled={isLoading}
        className={`flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 ${radiusClass} font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50`}
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canSubmit}
        className={`flex-[1.5] px-4 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider ${radiusClass} transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2`}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <ShieldAlert className="w-4 h-4" />
        )}
        <span>{confirmText}</span>
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Reason & Justification Required"
      subtitle="Privileged operation governance check (Non-Repudiation)"
      icon={<ShieldAlert className="w-6 h-6 text-rose-400" />}
      iconBg="bg-rose-500/15 border border-rose-500/30 text-rose-400"
      maxWidth="max-w-xl"
      footer={footer}
    >
      <div className="space-y-4 py-2 text-slate-200">
        {/* Action Callout */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs">
          <div className="flex items-center gap-2 font-bold text-white mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Target Action: {actionTitle}</span>
          </div>
          {resourceName && (
            <p className="text-slate-400 font-mono text-[11px] mb-1">Resource: {resourceName}</p>
          )}
          {actionDescription && <p className="text-slate-300">{actionDescription}</p>}
        </div>

        {/* Reason Code Dropdown */}
        <div>
          <label htmlFor="audit-reason-dropdown" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Audit Reason Code <span className="text-rose-400">*</span>
          </label>
          <select
            id="audit-reason-dropdown"
            value={selectedCode}
            onChange={e => {
              setSelectedCode(e.target.value);
              setError(null);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.12] text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
          >
            {STANDARD_REASON_CODES.map(item => (
              <option key={item.code} value={item.code} className="bg-slate-900 text-white">
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            {STANDARD_REASON_CODES.find(r => r.code === selectedCode)?.description}
          </p>
        </div>

        {/* Custom Reason Code Input (Conditional) */}
        {selectedCode === 'CUSTOM' && (
          <div>
            <label htmlFor="custom-reason-code-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Specify Custom Reason Code <span className="text-rose-400">*</span>
            </label>
            <input
              id="custom-reason-code-input"
              type="text"
              value={customCode}
              onChange={e => {
                setCustomCode(e.target.value);
                setError(null);
              }}
              placeholder="e.g. TICKET-9402-LEGAL-ERASURE"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.12] text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all uppercase"
            />
          </div>
        )}

        {/* Justification Textarea */}
        <div>
          <label htmlFor="audit-justification-input" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex justify-between">
            <span>Mandatory Justification Note <span className="text-rose-400">*</span></span>
            <span className={`text-[11px] ${justification.trim().length >= 10 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {justification.trim().length}/10 min characters
            </span>
          </label>
          <textarea
            id="audit-justification-input"
            rows={3}
            value={justification}
            onChange={e => {
              setJustification(e.target.value);
              setError(null);
            }}
            placeholder="Explain the business, agronomic, or compliance rationale for this mutation..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.12] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
          />
        </div>

        {/* Policy Certification Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-white/[0.08] cursor-pointer hover:bg-slate-950 transition-colors">
          <input
            type="checkbox"
            checked={certified}
            onChange={e => {
              setCertified(e.target.checked);
              setError(null);
            }}
            className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            I certify that this mutation is authorized under organization data governance policies and will be recorded immutably in the security audit trail.
          </span>
        </label>

        {/* Error Callout */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
