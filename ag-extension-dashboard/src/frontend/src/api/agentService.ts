import apiClient from './client';

export interface AgentStatus {
  agentId: string;
  name: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  currentLoad: number;
  health: 'healthy' | 'degraded' | 'offline';
  lastHeartbeat: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
}

export interface QueueStatus {
  queued: number;
  active: number;
  completed: number;
  failed: number;
}

export const fetchAgentStatus = async (): Promise<{ success: boolean; data: AgentStatus[] }> => {
  const response = await apiClient.get('/ai/agents/status');
  return response.data;
};

export const fetchQueueStatus = async (): Promise<{ success: boolean; data: QueueStatus }> => {
  const response = await apiClient.get('/ai/agents/queue');
  return response.data;
};

export const fetchHandoffLog = async (): Promise<{
  success: boolean;
  data: Array<{ from: string; to: string; taskId: string; reason: string; timestamp: string }>;
}> => {
  const response = await apiClient.get('/ai/agents/handoffs');
  return response.data;
};

export const dispatchTask = async (task: {
  type: string;
  payload: Record<string, unknown>;
  priority?: string;
  agentId?: string;
}): Promise<{ success: boolean; data: AgentTask }> => {
  const response = await apiClient.post('/ai/agents/dispatch', task);
  return response.data;
};
