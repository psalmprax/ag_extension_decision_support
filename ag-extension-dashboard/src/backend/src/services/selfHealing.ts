import { logger } from '@/utils/logger';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: string;
  error?: string;
  consecutiveFailures: number;
  lastSuccess: string | null;
}

export interface RecoveryAction {
  component: string;
  action: string;
  triggeredAt: string;
  success: boolean;
  details?: string;
}

export interface RecoveryRequestResult {
  success: boolean;
  status: 'completed' | 'failed' | 'rejected' | 'not_found';
  component: string;
  action?: string;
  details?: string;
}

export class SelfHealingService {
  private static instance: SelfHealingService;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private recoveryLog: RecoveryAction[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private maxConsecutiveFailures = 3;
  private recoveryAttempts: Map<string, number> = new Map();

  static getInstance(): SelfHealingService {
    if (!SelfHealingService.instance) {
      SelfHealingService.instance = new SelfHealingService();
    }
    return SelfHealingService.instance;
  }

  registerComponent(component: string): void {
    this.healthChecks.set(component, {
      component,
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      consecutiveFailures: 0,
      lastSuccess: new Date().toISOString(),
    });
    this.recoveryAttempts.set(component, 0);
  }

  startMonitoring(intervalMs = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, intervalMs);

    logger.info(`Self-healing monitoring started (interval: ${intervalMs}ms)`);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Self-healing monitoring stopped');
    }
  }

  private async handleCheckResult(component: string, health: HealthCheck, isHealthy: boolean) {
    if (isHealthy) {
      if (health.status !== 'healthy') {
        logger.info(`Component recovered: ${component}`);
        await this.triggerRecovery(component, 'auto_recovery', true);
      }
      health.status = 'healthy';
      health.consecutiveFailures = 0;
      health.lastSuccess = new Date().toISOString();
      this.recoveryAttempts.set(component, 0);
    } else {
      health.consecutiveFailures++;
      health.status = health.consecutiveFailures >= this.maxConsecutiveFailures ? 'unhealthy' : 'degraded';

      if (health.consecutiveFailures >= this.maxConsecutiveFailures) {
        logger.warn(`Component unhealthy: ${component} (${health.consecutiveFailures} consecutive failures)`);
        await this.attemptRecovery(component);
      }
    }
    health.lastCheck = new Date().toISOString();
  }

  private async handleCheckError(component: string, health: HealthCheck, error: unknown) {
    health.consecutiveFailures++;
    health.status = 'unhealthy';
    health.error = error instanceof Error ? error.message : String(error);
    health.lastCheck = new Date().toISOString();

    if (health.consecutiveFailures >= this.maxConsecutiveFailures) {
      await this.attemptRecovery(component);
    }
  }

  async runHealthChecks(): Promise<void> {
    for (const [component, health] of this.healthChecks) {
      try {
        const isHealthy = await this.checkComponent(component);
        await this.handleCheckResult(component, health, isHealthy);
      } catch (error) {
        await this.handleCheckError(component, health, error);
      }
    }
  }

  private async checkAiProvider(): Promise<boolean> {
    const provider = await AIProviderFactory.getPrimaryProvider();
    return provider.isConfigured() && await provider.healthCheck();
  }

  private async checkDatabase(): Promise<boolean> {
    const { getPool } = await import('@/services/databaseService');
    const pool = getPool();
    if (!pool) return false;
    await pool.query('SELECT 1');
    return true;
  }

  private async checkCache(): Promise<boolean> {
    const { getCache } = await import('@/services/cacheService');
    const redis = getCache();
    return redis?.isOpen || false;
  }

  private async checkAgentService(component: string): Promise<boolean> {
    const urls: Record<string, string> = {
      'agent-zero': process.env.AGENT_ZERO_URL || 'http://ag-agent-zero:8000',
      'crew-ai': process.env.CREW_AI_URL || 'http://ag-crew-ai:8001',
    };
    const url = urls[component];
    if (!url) return false;

    try {
      logger.info(`Checking health for ${component} at ${url}/health`);
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
      const isHealthy = response.ok;
      logger.info(`Health check for ${component}: ${isHealthy ? 'healthy' : 'unhealthy'} (${response.status})`);
      return isHealthy;
    } catch (error) {
      logger.warn(`Health check failed for ${component}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async requestRecovery(component: string): Promise<RecoveryRequestResult> {
    const allowedComponents = new Set(['ai-provider', 'database', 'cache', 'agent-zero', 'crew-ai']);
    if (!allowedComponents.has(component)) {
      return {
        success: false,
        status: 'rejected',
        component,
        details: 'Component is not eligible for manual recovery',
      };
    }

    if (!this.healthChecks.has(component)) {
      return {
        success: false,
        status: 'not_found',
        component,
        details: 'Component is not registered with the self-healing service',
      };
    }

    const before = this.recoveryLog.length;
    await this.attemptRecovery(component);
    const action = this.recoveryLog.slice(before).find(entry => entry.component === component);
    if (!action) {
      return {
        success: false,
        status: 'failed',
        component,
        details: 'Recovery did not produce an action record',
      };
    }

    return {
      success: action.success,
      status: action.success ? 'completed' : 'failed',
      component,
      action: action.action,
      details: action.details,
    };
  }

  async checkComponent(component: string): Promise<boolean> {
    try {
      switch (component) {
        case 'ai-provider':
          return await this.checkAiProvider();
        case 'database':
          return await this.checkDatabase();
        case 'cache':
          return await this.checkCache();
        case 'agent-zero':
        case 'crew-ai':
          return await this.checkAgentService(component);
        default:
          // Unknown components have no probe; report unknown rather than "healthy".
          logger.debug(`selfHealing: no health probe registered for component "${component}"`);
          return false;
      }
    } catch {
      return false;
    }
  }

  private async attemptRecovery(component: string): Promise<void> {
    const attempts = this.recoveryAttempts.get(component) || 0;
    if (attempts >= 5) {
      logger.error(`Max recovery attempts reached for ${component}, marking as offline`);
      const health = this.healthChecks.get(component);
      if (health) health.status = 'offline';
      return;
    }

    this.recoveryAttempts.set(component, attempts + 1);

    logger.info(`Attempting recovery for ${component} (attempt ${attempts + 1}/5)`);

    switch (component) {
      case 'ai-provider':
        await this.recoverAIProvider();
        break;
      case 'database':
        await this.recoverDatabase();
        break;
      case 'cache':
        await this.recoverCache();
        break;
      case 'agent-zero':
      case 'crew-ai':
        await this.recoverAgent(component);
        break;
      default:
        await this.triggerRecovery(component, 'generic_restart', false);
    }
  }

  private async recoverAIProvider(): Promise<void> {
    try {
      const { AIProviderFactory } = await import('@/services/aiProvider/aiProvider');
      const primary = await AIProviderFactory.getPrimaryProvider();
      const primaryHealthy = await primary.healthCheck();

      if (!primaryHealthy) {
        logger.warn('Primary AI provider unhealthy, attempting fallback');
        const fallback = await AIProviderFactory.getFallbackProvider();
        const fallbackHealthy = await fallback.healthCheck();

        if (fallbackHealthy) {
          // The router already prefers healthy providers on each request, so there is
          // no state to flip here. Record what is true: primary down, fallback serving.
          await this.triggerRecovery('ai-provider', 'primary_unhealthy_fallback_available', false, primary.getLastHealthError?.());
          return;
        }
        await this.triggerRecovery('ai-provider', 'primary_and_fallback_unhealthy', false, primary.getLastHealthError?.());
        return;
      }

      await this.triggerRecovery('ai-provider', 'health_check_retried', true);
    } catch (error) {
      await this.triggerRecovery('ai-provider', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverDatabase(): Promise<void> {
    try {
      const { initializeDatabase, getPool } = await import('@/services/databaseService');
      await initializeDatabase();
      // Verify the reconnect actually works before claiming success.
      const pool = getPool();
      if (!pool) throw new Error('database pool not initialized after reconnect');
      await pool.query('SELECT 1');
      await this.triggerRecovery('database', 'reconnected_and_verified', true);
    } catch (error) {
      await this.triggerRecovery('database', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverCache(): Promise<void> {
    try {
      const { initializeCache, getCache } = await import('@/services/cacheService');
      await initializeCache();
      const redis = getCache();
      if (!redis?.isOpen) throw new Error('cache client not open after reconnect');
      await this.triggerRecovery('cache', 'reconnected_and_verified', true);
    } catch (error) {
      await this.triggerRecovery('cache', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverAgent(agentId: string): Promise<void> {
    try {
      const urls: Record<string, string> = {
        'agent-zero': process.env.AGENT_ZERO_URL || 'http://ag-agent-zero:8000',
        'crew-ai': process.env.CREW_AI_URL || 'http://ag-crew-ai:8001',
      };

      const url = urls[agentId];
      if (!url) return;

      // fetch() resolves on 5xx — only a 2xx counts as recovered.
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        await this.triggerRecovery(agentId, 'agent_unhealthy', false, `HTTP ${res.status}`);
        return;
      }
      await this.triggerRecovery(agentId, 'health_check_passed', true);
    } catch {
      await this.triggerRecovery(agentId, 'agent_unreachable', false);
    }
  }

  private async triggerRecovery(component: string, action: string, success: boolean, details?: string): Promise<void> {
    const recovery: RecoveryAction = {
      component,
      action,
      triggeredAt: new Date().toISOString(),
      success,
      details,
    };
    this.recoveryLog.push(recovery);

    if (this.recoveryLog.length > 100) {
      this.recoveryLog = this.recoveryLog.slice(-100);
    }

    if (success) {
      logger.info(`Recovery successful: ${component} — ${action}`);
    } else {
      logger.error(`Recovery failed: ${component} — ${action}${details ? ` (${details})` : ''}`);
    }
  }

  getHealthStatus(): Map<string, HealthCheck> {
    return new Map(this.healthChecks);
  }

  getRecoveryLog(): RecoveryAction[] {
    return [...this.recoveryLog];
  }

  getUnhealthyComponents(): string[] {
    return Array.from(this.healthChecks.values())
      .filter(h => h.status === 'unhealthy' || h.status === 'offline')
      .map(h => h.component);
  }
}

export const selfHealingService = SelfHealingService.getInstance();
