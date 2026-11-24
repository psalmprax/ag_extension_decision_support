import apiClient from './client';

export interface CampaignStepTrace {
  step: string;
  status: 'completed' | 'in_progress' | 'skipped' | 'failed';
  detail: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface GoalCampaignResult {
  success: boolean;
  campaignId: string;
  summary: string;
  affectedFarmersCount: number;
  dispatchedMessagesCount: number;
  scheduledVisitsCount: number;
  executionTrace: CampaignStepTrace[];
  error?: string;
  /** What the safety check stopped: a rate, dose or waiting period. */
  violations?: string[];
}

/** Who would receive a campaign, and the AI's draft for the officer to edit. Nothing is sent. */
export interface GoalCampaignDraft {
  success: boolean;
  draftText: string;
  affectedFarmersCount: number;
  violations: string[];
}

export interface CampaignTarget {
  goalPrompt: string;
  targetRegion?: string;
  targetCrop?: string;
}

export const draftGoalCampaign = async (payload: CampaignTarget): Promise<GoalCampaignDraft> => {
  const response = await apiClient.post<GoalCampaignDraft>('/campaigns/goal/draft', payload);
  return response.data;
};

export interface CampaignHistoryItem {
  id: string;
  goal_prompt: string;
  target_region: string | null;
  target_crop: string | null;
  status: string;
  affected_farmers_count: number;
  dispatched_messages_count: number;
  scheduled_visits_count: number;
  execution_trace: CampaignStepTrace[];
  advisory_summary: string | null;
  created_at: string;
}

export interface RegionalSkillCard {
  id: string;
  region: string;
  crop: string;
  topic: string;
  title: string;
  skill_markdown: string;
  source_type: string;
  confidence_score: number;
  usage_count: number;
  created_at: string;
}

export const executeGoalCampaign = async (payload: CampaignTarget & {
  channel?: 'all' | 'sms' | 'whatsapp' | 'telegram';
  autoScheduleVisits?: boolean;
  /** The message the officer read and approved. */
  message: string;
}): Promise<GoalCampaignResult> => {
  const response = await apiClient.post<GoalCampaignResult>('/campaigns/goal', payload);
  return response.data;
};

export interface OutreachDeliveryStats {
  totals: {
    total: number;
    sent: number;
    failed: number;
    queued: number;
    processing: number;
    sentRate: number;
  };
  byChannel: Array<{
    channel: string;
    total: number;
    sent: number;
    failed: number;
  }>;
  recentFailures: Array<{
    id: string;
    channel: string;
    recipient: string | null;
    lastError: string | null;
    attempts: number;
    updatedAt: string;
  }>;
}

export const fetchCampaignHistory = async (): Promise<{ success: boolean; data: CampaignHistoryItem[] }> => {
  const response = await apiClient.get<{ success: boolean; data: CampaignHistoryItem[] }>('/campaigns/history');
  return response.data;
};

export const fetchOutreachStats = async (): Promise<{ success: boolean; data: OutreachDeliveryStats }> => {
  const response = await apiClient.get<{ success: boolean; data: OutreachDeliveryStats }>('/campaigns/outreach-stats');
  return response.data;
};

export const retryOutreachMessages = async (ids: string[]): Promise<{ success: boolean; data: { requeued: number } }> => {
  const response = await apiClient.post<{ success: boolean; data: { requeued: number } }>(
    '/campaigns/outreach-stats/retry',
    { ids }
  );
  return response.data;
};

export const fetchRegionalSkills = async (params?: {
  region?: string;
  crop?: string;
}): Promise<{ success: boolean; data: RegionalSkillCard[] }> => {
  const response = await apiClient.get<{ success: boolean; data: RegionalSkillCard[] }>('/campaigns/skills', {
    params,
  });
  return response.data;
};

export const synthesizeSkillFromVisit = async (payload: {
  visitId?: string;
  region: string;
  crop: string;
  topic: string;
  findings: string;
  officerNotes?: string;
}): Promise<{ success: boolean; data: RegionalSkillCard }> => {
  const response = await apiClient.post<{ success: boolean; data: RegionalSkillCard }>(
    '/campaigns/skills/synthesize',
    payload
  );
  return response.data;
};
