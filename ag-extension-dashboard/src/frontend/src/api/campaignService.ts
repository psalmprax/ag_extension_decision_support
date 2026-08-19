import apiClient from './client';

interface CampaignStepTrace {
  step: string;
  status: 'completed' | 'in_progress' | 'skipped' | 'failed';
  detail: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface GoalCampaignResult {
  success: boolean;
  campaignId: string;
  summary: string;
  affectedFarmersCount: number;
  dispatchedMessagesCount: number;
  scheduledVisitsCount: number;
  executionTrace: CampaignStepTrace[];
  error?: string;
}

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

export const executeGoalCampaign = async (payload: {
  goalPrompt: string;
  targetRegion?: string;
  targetCrop?: string;
  channel?: 'all' | 'sms' | 'whatsapp' | 'telegram';
  autoScheduleVisits?: boolean;
}): Promise<GoalCampaignResult> => {
  const response = await apiClient.post<GoalCampaignResult>('/campaigns/goal', payload);
  return response.data;
};

export const fetchCampaignHistory = async (): Promise<{ success: boolean; data: CampaignHistoryItem[] }> => {
  const response = await apiClient.get<{ success: boolean; data: CampaignHistoryItem[] }>('/campaigns/history');
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
