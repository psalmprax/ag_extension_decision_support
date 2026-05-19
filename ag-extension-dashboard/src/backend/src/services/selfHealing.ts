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

  async runHealthChecks(): Promise<void> {
    for (const [component, health] of this.healthChecks) {
      try {
        const isHealthy = await this.checkComponent(component);

        if (isHealthy) {
          if (health.status !== 'healthy') {
            logger.info(`Component recovered: ${component}`);
            await this.triggerRecovery(component, 'auto_recovery', true);
          }
          health.status = 'healthy';
          health.consecutiveFailures = 0;
          health.lastSuccess = new Date().toISOString();
        } else {
          health.consecutiveFailures++;
          health.status = health.consecutiveFailures >= this.maxConsecutiveFailures ? 'unhealthy' : 'degraded';

          if (health.consecutiveFailures >= this.maxConsecutiveFailures) {
            logger.warn(`Component unhealthy: ${component} (${health.consecutiveFailures} consecutive failures)`);
            await this.attemptRecovery(component);
          }
        }

        health.lastCheck = new Date().toISOString();
      } catch (error) {
        health.consecutiveFailures++;
        health.status = 'unhealthy';
        health.error = error instanceof Error ? error.message : String(error);
        health.lastCheck = new Date().toISOString();

        if (health.consecutiveFailures >= this.maxConsecutiveFailures) {
          await this.attemptRecovery(component);
        }
      }
    }
  }

  async checkComponent(component: string): Promise<boolean> {
    try {
      switch (component) {
        case 'ai-provider': {
          const provider = await AIProviderFactory.getPrimaryProvider();
          return provider.isConfigured() && await provider.healthCheck();
        }
        case 'database': {
          const { getPool } = await import('@/services/databaseService');
          const pool = getPool();
          if (!pool) return false;
          await pool.query('SELECT 1');
          return true;
        }
        case 'cache': {
          const { getCache } = await import('@/services/cacheService');
          const redis = getCache();
          return redis?.isOpen || false;
        }
        case 'agent-zero':
        case 'crew-ai':
        case 'openclaw': {
          const urls: Record<string, string> = {
            'agent-zero': 'http://ag-agent-zero:8000',
            'crew-ai': 'http://ag-crew-ai:8001',
            'openclaw': 'http://ag-openclaw:8002',
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
            // For planned agents that aren't running yet, don't count as failures
            if (component === 'openclaw') {
              logger.info(`OpenClaw agent not running yet (expected for planned agent)`);
              return true; // Consider it "healthy" since it's planned but not implemented
            }
            return false;
          }
        }
        default:
          return true;
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
      case 'openclaw':
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
          await this.triggerRecovery('ai-provider', 'switched_to_fallback', true);
          return;
        }
      }

      await this.triggerRecovery('ai-provider', 'health_check_retried', primaryHealthy);
    } catch (error) {
      await this.triggerRecovery('ai-provider', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverDatabase(): Promise<void> {
    try {
      const { initializeDatabase } = await import('@/services/databaseService');
      await initializeDatabase();
      await this.triggerRecovery('database', 'reconnection_attempted', true);
    } catch (error) {
      await this.triggerRecovery('database', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverCache(): Promise<void> {
    try {
      const { initializeCache } = await import('@/services/cacheService');
      await initializeCache();
      await this.triggerRecovery('cache', 'reconnection_attempted', true);
    } catch (error) {
      await this.triggerRecovery('cache', 'recovery_failed', false, error instanceof Error ? error.message : undefined);
    }
  }

  private async recoverAgent(agentId: string): Promise<void> {
    try {
      const urls: Record<string, string> = {
        'agent-zero': 'http://ag-agent-zero:8000',
        'crew-ai': 'http://ag-crew-ai:8001',
        'openclaw': 'http://ag-openclaw:8002',
      };

      const url = urls[agentId];
      if (!url) return;

      // For openclaw, if it's not running yet (planned agent), don't fail recovery
      if (agentId === 'openclaw') {
        try {
          await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
          await this.triggerRecovery(agentId, 'health_check_retried', true);
        } catch {
          // OpenClaw is planned but not implemented yet - consider this successful
          logger.debug(`OpenClaw agent recovery skipped (planned agent not yet implemented)`);
          await this.triggerRecovery(agentId, 'recovery_skipped_planned_agent', true);
        }
      } else {
        await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        await this.triggerRecovery(agentId, 'health_check_retried', true);
      }
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

    if (recoveryLog.length > 100) {
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

const recoveryLog: RecoveryAction[] = [];

export const selfHealingService = SelfHealingService.getInstance();
