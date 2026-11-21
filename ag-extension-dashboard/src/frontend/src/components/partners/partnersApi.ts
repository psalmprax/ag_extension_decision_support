import apiClient from '@/api/client';

export interface ContentPartner {
  id: string;
  name: string;
  website: string | null;
  contactEmail: string | null;
  recordings: number;
  approved: number;
  organisations: string[];
}

export interface PartnerRecording {
  id: string;
  partnerId: string;
  partner: string;
  title: string;
  speaker: string;
  language: string;
  crops: string[];
  regions: string[];
  topic: string | null;
  licence: string;
  licenceExpiresAt: string | null;
  transcript: string | null;
  transcriptStatus: 'pending' | 'transcribed' | 'failed';
  reviewStatus: 'pending_review' | 'approved' | 'rejected';
  deliveries: number;
  url: string;
}

export interface ImportReport {
  imported: number;
  skipped: Array<{ file: string; reason: string }>;
}

export async function listPartners(): Promise<{ partners: ContentPartner[]; manifestColumns: string[]; maxArchiveMb: number }> {
  const { data } = await apiClient.get('/content-partners');
  return data.data;
}

export async function listOrganisations(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await apiClient.get('/content-partners/organisations');
  return data.data.organisations;
}

export async function addPartner(input: { name: string; website?: string; contactEmail?: string }): Promise<{ id: string }> {
  const { data } = await apiClient.post('/content-partners', {
    name: input.name,
    website: input.website || undefined,
    contactEmail: input.contactEmail || undefined,
  });
  return data.data;
}

export async function setGrant(partnerId: string, organisationId: string, granted: boolean): Promise<void> {
  const path = `/content-partners/${partnerId}/grants/${organisationId}`;
  await (granted ? apiClient.put(path) : apiClient.delete(path));
}

export async function importLibrary(partnerId: string, archive: File): Promise<ImportReport> {
  const form = new FormData();
  form.append('archive', archive);
  const { data } = await apiClient.post(`/imports/partner-recordings/${partnerId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600_000,
  });
  return data.data;
}

export async function listRecordings(filters: { status?: string; language?: string; crop?: string } = {}): Promise<PartnerRecording[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const { data } = await apiClient.get('/partner-recordings', { params });
  return data.data.recordings;
}

export async function recordingsForFarmer(farmerId: string): Promise<PartnerRecording[]> {
  const { data } = await apiClient.get(`/partner-recordings/for-farmer/${farmerId}`);
  return data.data.recordings;
}

export async function reviewRecording(id: string, decision: 'approve' | 'reject', transcript?: string): Promise<PartnerRecording> {
  const { data } = await apiClient.post(`/partner-recordings/${id}/review`, { decision, transcript });
  return data.data;
}

export async function sendRecording(id: string, farmerIds: string[]): Promise<{ sent: number; skipped: number }> {
  const { data } = await apiClient.post(`/partner-recordings/${id}/send`, { farmerIds });
  return data.data;
}
