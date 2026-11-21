// fallow-ignore-next-line unused-type
export interface AuditContext {
  reasonCode: string;
  justification: string;
}

export const STANDARD_REASON_CODES = [
  {
    code: 'SUSPECTED_ACCOUNT_COMPROMISE',
    label: 'Suspected account compromise',
    description: 'Emergency lockdown or credential revocation due to anomalous activity.',
  },
  {
    code: 'COMPLIANCE_GDPR_ERASURE',
    label: 'Data erasure request (GDPR)',
    description: 'Verified Right to Erasure or privacy compliance obligation.',
  },
  {
    code: 'FARMER_RECORD_DISPUTE',
    label: 'Farmer record dispute or boundary correction',
    description: 'Rectifying contested land parcels, crops, or contact information.',
  },
  {
    code: 'DATA_INTEGRITY_CORRECTION',
    label: 'Data correction',
    description: 'Fixing corrupted telemetry, sensor anomalies, or duplicate profiles.',
  },
  {
    code: 'OFFICER_OFFBOARDING',
    label: 'Officer leaving or access removed',
    description: 'Deprovisioning accounts or reassigning portfolio farmers.',
  },
  {
    code: 'EMERGENCY_FIELD_TRIAGE',
    label: 'Emergency field response',
    description: 'Critical pest outbreak containment or weather crisis override.',
  },
  {
    code: 'ROUTINE_SYSTEM_MAINTENANCE',
    label: 'Scheduled maintenance',
    description: 'Routine verified administrative housekeeping or database hygiene.',
  },
  {
    code: 'CUSTOM',
    label: 'Other reason (describe below)',
    description: 'Enter a custom tracking ticket or specific governance code.',
  },
] as const;

export type StandardReasonCode = (typeof STANDARD_REASON_CODES)[number]['code'];

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
