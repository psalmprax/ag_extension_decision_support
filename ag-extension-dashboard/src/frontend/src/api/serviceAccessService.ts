import apiClient from '@/api/client';
import type { PaidService } from '@/lib/planAccess';

export interface ServiceGrant {
  service: PaidService;
  label: string;
  grantedAt: string;
  expiresAt: string | null;
  grantedBy: string | null;
  note: string | null;
}

export interface ServiceAccessState {
  grantable: Array<{ service: PaidService; label: string }>;
  active: ServiceGrant[];
}

/** System administrator only: the paid services this account may be given, and its active grants. */
export async function fetchServiceAccess(userId: string): Promise<ServiceAccessState> {
  const { data } = await apiClient.get<{ data?: Partial<ServiceAccessState> }>(`/users/${userId}/service-access`);
  // An unexpected payload must not take the whole access dialog down with it.
  return {
    grantable: Array.isArray(data?.data?.grantable) ? data.data.grantable : [],
    active: Array.isArray(data?.data?.active) ? data.data.active : [],
  };
}

export async function grantServiceAccess(userId: string, service: PaidService, expiresAt: string | null): Promise<ServiceGrant[]> {
  const { data } = await apiClient.put<{ data: { active: ServiceGrant[] } }>(`/users/${userId}/service-access/${service}`, { expiresAt });
  return data.data.active;
}

export async function revokeServiceAccess(userId: string, service: PaidService): Promise<ServiceGrant[]> {
  const { data } = await apiClient.delete<{ data: { active: ServiceGrant[] } }>(`/users/${userId}/service-access/${service}`);
  return data.data.active;
}
