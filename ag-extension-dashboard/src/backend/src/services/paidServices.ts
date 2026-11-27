/**
 * The paid services behind `requirePaidPlan`, and which roles the system
 * administrator may open each one to without changing the account's plan.
 */
export const PAID_SERVICES = {
  chat: {
    label: 'Farmer chat & AI assistant',
    grantableTo: ['farmer', 'extension_officer', 'regional_manager'],
  },
  field_visits: {
    label: 'Field Visits & Tracking',
    grantableTo: ['farmer', 'extension_officer', 'regional_manager'],
  },
  analytics: {
    label: 'Operational Analytics & Telemetry',
    grantableTo: ['extension_officer', 'regional_manager'],
  },
  campaigns: {
    label: 'Autonomous outreach campaigns',
    grantableTo: ['extension_officer', 'regional_manager'],
  },
  worldmonitor: {
    label: 'WorldMonitor Spatial Intelligence',
    grantableTo: ['extension_officer', 'regional_manager'],
  },
  knowledge_ai: {
    label: 'Knowledge AI answers',
    grantableTo: ['farmer', 'extension_officer', 'regional_manager'],
  },
  fields: {
    label: 'Crops & fields',
    grantableTo: ['farmer', 'extension_officer', 'regional_manager'],
  },
  reports: {
    label: 'Reports',
    grantableTo: ['extension_officer', 'regional_manager'],
  },
  // Only admins reach the email workflows, and admins are never on the Free plan.
  email_workflows: {
    label: 'Automated Email Workflows',
    grantableTo: [],
  },
} as const satisfies Record<string, { label: string; grantableTo: readonly string[] }>;

export type PaidService = keyof typeof PAID_SERVICES;

export function isPaidService(value: unknown): value is PaidService {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAID_SERVICES, value);
}

export function isGrantableTo(service: PaidService, role: string): boolean {
  return (PAID_SERVICES[service].grantableTo as readonly string[]).includes(role);
}
