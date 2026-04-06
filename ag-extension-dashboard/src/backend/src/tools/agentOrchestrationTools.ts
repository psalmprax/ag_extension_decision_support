import { z } from 'zod';
import { Tool } from './types';
import { agentOrchestrator } from '@/services/agentOrchestrator';

const dispatchTaskSchema = z.object({
  type: z.string().describe('Task type (e.g., farmer_outreach, market_analysis, disease_diagnosis, policy_research)'),
  payload: z.record(z.unknown()).describe('Task payload data'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe('Task priority'),
  agentId: z.string().optional().describe('Preferred agent ID'),
});

const handoffTaskSchema = z.object({
  taskId: z.string().describe('Task ID to hand off'),
  targetAgentId: z.string().describe('Target agent ID'),
  reason: z.string().describe('Reason for handoff'),
});

const taskStatusSchema = z.object({
  taskId: z.string().describe('Task ID to check status'),
});

export const dispatchTaskTool: Tool<typeof dispatchTaskSchema> = {
  name: 'dispatch_agent_task',
  description: 'Dispatches a task to the most appropriate AI agent based on task type and agent capabilities. Use when coordinating multi-agent workflows, delegating specialized tasks, or orchestrating complex agricultural operations.',
  schema: dispatchTaskSchema,
  execute: async ({ type, payload, priority, agentId }) => {
    const task = await agentOrchestrator.dispatchTask({
      agentId: agentId || '',
      type,
      payload,
      priority,
      maxRetries: 3,
    });

    return JSON.stringify({
      taskId: task.id,
      assignedAgent: task.agentId,
      status: task.status,
      priority: task.priority,
      message: task.status === 'failed' ? task.error : 'Task dispatched successfully',
    }, null, 2);
  },
};

export const handoffTaskTool: Tool<typeof handoffTaskSchema> = {
  name: 'handoff_agent_task',
  description: 'Transfers a running or queued task from one agent to another. Use when an agent is overloaded, unhealthy, or lacks the required expertise for a task.',
  schema: handoffTaskSchema,
  execute: async ({ taskId, targetAgentId, reason }) => {
    const success = await agentOrchestrator.handoffTask(taskId, targetAgentId, reason);
    return success
      ? `Task ${taskId} handed off to ${targetAgentId}: ${reason}`
      : `Failed to handoff task ${taskId} — task not found or target agent unavailable`;
  },
};

export const taskStatusTool: Tool<typeof taskStatusSchema> = {
  name: 'check_task_status',
  description: 'Checks the current status of a dispatched task. Use when monitoring task progress, checking completion, or debugging failed tasks.',
  schema: taskStatusSchema,
  execute: async ({ taskId }) => {
    const task = agentOrchestrator.getTaskStatus(taskId);
    if (!task) return `Task ${taskId} not found`;

    return JSON.stringify({
      taskId: task.id,
      agentId: task.agentId,
      type: task.type,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      result: task.result,
      error: task.error,
      retryCount: task.retryCount,
      handedOffTo: task.handedOffTo,
    }, null, 2);
  },
};
