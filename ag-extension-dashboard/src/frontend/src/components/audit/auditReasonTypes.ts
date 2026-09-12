// fallow-ignore-next-line unused-type
export interface AuditContext {
  reasonCode: string;
  justification: string;
}

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
