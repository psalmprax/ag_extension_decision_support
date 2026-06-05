import { logger } from '@/utils/logger';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'handed_off';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
  handedOffTo?: string;
  handoffReason?: string;
  retryCount: number;
  maxRetries: number;
}

export interface AgentCapability {
  agentId: string;
  name: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  currentLoad: number;
  health: 'healthy' | 'degraded' | 'offline';
  lastHeartbeat: string;
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private taskQueue: AgentTask[] = [];
  private activeTasks: Map<string, AgentTask> = new Map();
  private completedTasks: AgentTask[] = [];
  private agentRegistry: Map<string, AgentCapability> = new Map();
  private handoffLog: Array<{ from: string; to: string; taskId: string; reason: string; timestamp: string }> = [];

  static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  registerAgent(config: {
    agentId: string;
    name: string;
    capabilities: string[];
    maxConcurrentTasks?: number;
    url?: string;
  }): void {
    this.agentRegistry.set(config.agentId, {
      agentId: config.agentId,
      name: config.name,
      capabilities: config.capabilities,
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      currentLoad: 0,
      health: 'healthy',
      lastHeartbeat: new Date().toISOString(),
    });
    logger.info(`Agent registered: ${config.agentId} (${config.capabilities.join(', ')})`);
  }

  async dispatchTask(task: Omit<AgentTask, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<AgentTask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullTask: AgentTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3,
    };

    const bestAgent = this.selectBestAgent(task.type, task.agentId);
    if (!bestAgent) {
      fullTask.status = 'failed';
      fullTask.error = 'No available agent for this task type';
      return fullTask;
    }

    fullTask.agentId = bestAgent.agentId;
    this.taskQueue.push(fullTask);

    logger.info(`Task dispatched: ${taskId} → ${bestAgent.agentId} (${task.type})`);
    return fullTask;
  }

  async executeNext(): Promise<AgentTask | null> {
    if (this.taskQueue.length === 0) return null;

    const task = this.taskQueue.shift()!;
    const agent = this.agentRegistry.get(task.agentId);

    if (!agent || agent.health === 'offline' || agent.currentLoad >= agent.maxConcurrentTasks) {
      // Push to back of queue to avoid starvation — other tasks get a chance
      this.taskQueue.push(task);
      return null;
    }

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    agent.currentLoad++;
    this.activeTasks.set(task.id, task);

    try {
      const result = await this.executeTaskOnAgent(task, agent);
      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      agent.currentLoad--;
      this.activeTasks.delete(task.id);
      this.completedTasks.push(task);

      logger.info(`Task completed: ${task.id} by ${agent.name}`);
      return task;
    } catch (error) {
      agent.currentLoad--;
      this.activeTasks.delete(task.id);

      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'pending';
        this.taskQueue.push(task);
        logger.warn(`Task ${task.id} failed, retrying (${task.retryCount}/${task.maxRetries})`);
        return null;
      }

      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = new Date().toISOString();
      this.completedTasks.push(task);

      logger.error(`Task ${task.id} failed permanently: ${task.error}`);
      return task;
    }
  }

  async handoffTask(taskId: string, targetAgentId: string, reason: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId) || this.taskQueue.find(t => t.id === taskId);
    if (!task) return false;

    const targetAgent = this.agentRegistry.get(targetAgentId);
    if (!targetAgent || targetAgent.health === 'offline') return false;

    const previousAgent = task.agentId;
    task.agentId = targetAgentId;
    task.handedOffTo = targetAgentId;
    task.handoffReason = reason;
    task.status = 'pending';
    // Do NOT reset retryCount — prevents infinite handoff loops

    this.handoffLog.push({
      from: previousAgent,
      to: targetAgentId,
      taskId,
      reason,
      timestamp: new Date().toISOString(),
    });

    if (this.activeTasks.has(taskId)) {
      const prevAgent = this.agentRegistry.get(previousAgent);
      if (prevAgent) prevAgent.currentLoad--;
      this.activeTasks.delete(taskId);
    }

    if (!this.taskQueue.includes(task)) {
      this.taskQueue.push(task);
    }

    logger.info(`Task ${taskId} handed off: ${previousAgent} → ${targetAgentId} (${reason})`);
    return true;
  }

  async autoHandoffOnFailure(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    const alternatives = this.findAlternativeAgents(task.type, task.agentId);
    if (alternatives.length === 0) return false;

    const nextAgent = alternatives[0];
    return this.handoffTask(taskId, nextAgent.agentId, `Auto-handoff: ${task.agentId} failed`);
  }

  getTaskStatus(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId)
      || this.completedTasks.find(t => t.id === taskId)
      || this.taskQueue.find(t => t.id === taskId);
  }

  getQueueStatus(): { queued: number; active: number; completed: number; failed: number } {
    const failed = this.completedTasks.filter(t => t.status === 'failed').length;
    const completed = this.completedTasks.filter(t => t.status === 'completed').length;
    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      completed,
      failed,
    };
  }

  getAgentStatus(): AgentCapability[] {
    return Array.from(this.agentRegistry.values());
  }

  getHandoffLog(): typeof this.handoffLog {
    return [...this.handoffLog];
  }

  private selectBestAgent(taskType: string, preferredAgentId?: string): AgentCapability | null {
    if (preferredAgentId) {
      const preferred = this.agentRegistry.get(preferredAgentId);
      if (preferred && preferred.health !== 'offline' && preferred.currentLoad < preferred.maxConcurrentTasks) {
        return preferred;
      }
    }

    const candidates = Array.from(this.agentRegistry.values())
      .filter(agent =>
        agent.health !== 'offline'
        && agent.currentLoad < agent.maxConcurrentTasks
        && (agent.capabilities.includes(taskType) || agent.capabilities.includes('*'))
      )
      .sort((a, b) => a.currentLoad / a.maxConcurrentTasks - b.currentLoad / b.maxConcurrentTasks);

    return candidates[0] || null;
  }

  private findAlternativeAgents(taskType: string, excludeAgentId: string): AgentCapability[] {
    return Array.from(this.agentRegistry.values())
      .filter(agent =>
        agent.agentId !== excludeAgentId
        && agent.health !== 'offline'
        && (agent.capabilities.includes(taskType) || agent.capabilities.includes('*'))
      )
      .sort((a, b) => a.currentLoad / a.maxConcurrentTasks - b.currentLoad / b.maxConcurrentTasks);
  }

  private async executeTaskOnAgent(task: AgentTask, agent: AgentCapability): Promise<string> {
    const agentConfig = this.agentRegistry.get(agent.agentId);
    if (!agentConfig) throw new Error(`Agent ${agent.agentId} not found`);

    const prompt = this.buildTaskPrompt(task);

    // Execute with fallback — generateText runs INSIDE the fallback callback
    // 2 minute timeout per task is enforced by the AI provider
    const result = await AIProviderFactory.getWithFallback(async (provider) => {
      return await provider.generateText([
        { role: 'system', content: `You are ${agent.name}, an AI agent specialized in: ${agent.capabilities.join(', ')}. Execute the assigned task and return a structured result.` },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, maxTokens: 2000 });
    });

    return result.text || 'Task executed with no output';
  }

  private buildTaskPrompt(task: AgentTask): string {
    return `TASK EXECUTION REQUEST
Task ID: ${task.id}
Type: ${task.type}
Priority: ${task.priority}
Payload: ${JSON.stringify(task.payload, null, 2)}

Execute this task and return a clear, structured result. Include any relevant data, recommendations, or next steps.`;
  }
}

export const agentOrchestrator = AgentOrchestrator.getInstance();
