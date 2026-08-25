/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export interface TelemetryEvent {
  id: string;
  eventType: 'tool_call' | 'agent_request' | 'error' | 'response' | 'handoff' | 'memory_access';
  agentId?: string;
  toolName?: string;
  userId?: string;
  durationMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  status: 'success' | 'error' | 'timeout';
  metadata?: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}

export interface TelemetrySummary {
  totalRequests: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  toolUsage: Record<string, number>;
  agentUsage: Record<string, number>;
  errorRate: number;
}

/** Raw `agent_telemetry` row shape as returned by `pg`. */
interface TelemetryRow {
  id: string;
  event_type: TelemetryEvent['eventType'];
  agent_id: string | null;
  tool_name: string | null;
  user_id: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  status: TelemetryEvent['status'];
  metadata: Record<string, unknown> | null;
  correlation_id: string | null;
  timestamp: Date | string;
}

interface TelemetryCountRow {
  count: string;
  avg?: string | null;
  coalesce?: string | null;
}

interface TelemetryGroupRow {
  count: string;
  tool_name?: string | null;
  agent_id?: string | null;
}

export class AgentTelemetry {
  private static instance: AgentTelemetry;
  private initialized = false;
  private inMemoryEvents: TelemetryEvent[] = [];
  private maxInMemory = 1000;

  static getInstance(): AgentTelemetry {
    if (!AgentTelemetry.instance) {
      AgentTelemetry.instance = new AgentTelemetry();
    }
    return AgentTelemetry.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const pool = getPool();
      if (!pool) {
        logger.warn('Cannot initialize telemetry — database unavailable');
        return;
      }

      await query(`
        CREATE TABLE IF NOT EXISTS agent_telemetry (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          agent_id VARCHAR(100),
          tool_name VARCHAR(100),
          user_id VARCHAR(100),
          duration_ms INTEGER,
          tokens_used INTEGER,
          cost_usd FLOAT,
          status VARCHAR(20) NOT NULL DEFAULT 'success',
          metadata JSONB,
          correlation_id VARCHAR(128),
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_type 
        ON agent_telemetry(event_type)
      `);

      await query(`
        ALTER TABLE agent_telemetry ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(128)
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp 
        ON agent_telemetry(timestamp DESC)
      `);

      this.initialized = true;
      logger.info('Agent telemetry initialized');
    } catch (error) {
      logger.error('Failed to initialize telemetry:', error);
    }
  }

  private async saveEventToDatabase(telemetryEvent: TelemetryEvent): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    await query(`
      INSERT INTO agent_telemetry (event_type, agent_id, tool_name, user_id, duration_ms, tokens_used, cost_usd, status, metadata, correlation_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      telemetryEvent.eventType,
      telemetryEvent.agentId || null,
      telemetryEvent.toolName || null,
      telemetryEvent.userId || null,
      telemetryEvent.durationMs || null,
      telemetryEvent.tokensUsed || null,
      telemetryEvent.costUsd || null,
      telemetryEvent.status,
      telemetryEvent.metadata ? JSON.stringify(telemetryEvent.metadata) : null,
      telemetryEvent.correlationId || null,
    ]);
    return true;
  }

  async record(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<void> {
    const telemetryEvent: TelemetryEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
    };

    if (this.initialized) {
      try {
        if (await this.saveEventToDatabase(telemetryEvent)) {
          return;
        }
      } catch (error) {
        logger.warn('Failed to record telemetry to DB, using in-memory:', error);
      }
    }

    this.inMemoryEvents.push(telemetryEvent);
    if (this.inMemoryEvents.length > this.maxInMemory) {
      this.inMemoryEvents = this.inMemoryEvents.slice(-this.maxInMemory);
    }
  }

  async recordToolCall(toolName: string, userId: string, durationMs: number, status: 'success' | 'error' | 'timeout', metadata?: Record<string, unknown>): Promise<void> {
    await this.record({
      eventType: 'tool_call',
      toolName,
      userId,
      durationMs,
      status,
      metadata,
    });
  }

  async recordAgentRequest(
    agentId: string,
    userId: string,
    tokensUsed: number,
    costUsd: number,
    durationMs: number,
    correlationId?: string
  ): Promise<void> {
    await this.record({
      eventType: 'agent_request',
      agentId,
      userId,
      tokensUsed,
      costUsd,
      durationMs,
      status: 'success',
      correlationId,
    });
  }

  async recordError(toolName: string | undefined, userId: string | undefined, error: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.record({
      eventType: 'error',
      toolName,
      userId,
      status: 'error',
      metadata: { ...metadata, errorMessage: error },
    });
  }

  async getSummary(hours = 24): Promise<TelemetrySummary> {
    const pool = getPool();
    if (!pool || !this.initialized) {
      return this.getInMemorySummary();
    }

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const [totalReq, totalErr, avgTime, totalTokens, totalCost] = await Promise.all([
        query<TelemetryCountRow>(`SELECT COUNT(*) FROM agent_telemetry WHERE timestamp > $1`, [since]),
        query<TelemetryCountRow>(`SELECT COUNT(*) FROM agent_telemetry WHERE timestamp > $1 AND status = 'error'`, [since]),
        query<TelemetryCountRow>(`SELECT AVG(duration_ms) FROM agent_telemetry WHERE timestamp > $1 AND duration_ms IS NOT NULL`, [since]),
        query<TelemetryCountRow>(`SELECT COALESCE(SUM(tokens_used), 0) FROM agent_telemetry WHERE timestamp > $1`, [since]),
        query<TelemetryCountRow>(`SELECT COALESCE(SUM(cost_usd), 0) FROM agent_telemetry WHERE timestamp > $1`, [since]),
      ]);

      const toolResult = await query<TelemetryGroupRow>(`
        SELECT tool_name, COUNT(*) as count 
        FROM agent_telemetry 
        WHERE timestamp > $1 AND tool_name IS NOT NULL 
        GROUP BY tool_name 
        ORDER BY count DESC
      `, [since]);

      const agentResult = await query<TelemetryGroupRow>(`
        SELECT agent_id, COUNT(*) as count 
        FROM agent_telemetry 
        WHERE timestamp > $1 AND agent_id IS NOT NULL 
        GROUP BY agent_id 
        ORDER BY count DESC
      `, [since]);

      const toolUsage: Record<string, number> = {};
      for (const row of toolResult.rows) {
        if (row.tool_name) toolUsage[row.tool_name] = parseInt(row.count);
      }

      const agentUsage: Record<string, number> = {};
      for (const row of agentResult.rows) {
        if (row.agent_id) agentUsage[row.agent_id] = parseInt(row.count);
      }

      const totalRequests = parseInt(totalReq.rows[0].count);
      const totalErrors = parseInt(totalErr.rows[0].count);

      return {
        totalRequests,
        totalErrors,
        avgResponseTimeMs: Math.round(parseFloat(avgTime.rows[0].avg ?? '0') || 0),
        totalTokensUsed: parseInt(totalTokens.rows[0].coalesce ?? '0'),
        totalCostUsd: parseFloat(totalCost.rows[0].coalesce ?? '0'),
        toolUsage,
        agentUsage,
        errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get telemetry summary:', error);
      return this.getInMemorySummary();
    }
  }

  async getRecentEvents(limit = 50): Promise<TelemetryEvent[]> {
    const pool = getPool();
    if (!pool || !this.initialized) {
      return this.inMemoryEvents.slice(-limit);
    }

    try {
      const result = await query<TelemetryRow>(`
        SELECT id, event_type, agent_id, tool_name, user_id, duration_ms, tokens_used, cost_usd, status, metadata, correlation_id, timestamp
        FROM agent_telemetry
        ORDER BY timestamp DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        agentId: row.agent_id ?? undefined,
        toolName: row.tool_name ?? undefined,
        userId: row.user_id ?? undefined,
        durationMs: row.duration_ms ?? undefined,
        tokensUsed: row.tokens_used ?? undefined,
        costUsd: row.cost_usd ?? undefined,
        status: row.status,
        metadata: row.metadata ?? undefined,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
        correlationId: row.correlation_id ?? undefined,
      }));
    } catch (error) {
      logger.error('Failed to get recent events:', error);
      return this.inMemoryEvents.slice(-limit);
    }
  }

  private getInMemorySummary(): TelemetrySummary {
    const events = this.inMemoryEvents;
    const totalRequests = events.length;
    const totalErrors = events.filter(e => e.status === 'error').length;
    const durations = events.filter(e => e.durationMs).map(e => e.durationMs!);
    const avgResponseTimeMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const totalTokensUsed = events.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const totalCostUsd = events.reduce((sum, e) => sum + (e.costUsd || 0), 0);

    const toolUsage: Record<string, number> = {};
    const agentUsage: Record<string, number> = {};
    for (const event of events) {
      if (event.toolName) toolUsage[event.toolName] = (toolUsage[event.toolName] || 0) + 1;
      if (event.agentId) agentUsage[event.agentId] = (agentUsage[event.agentId] || 0) + 1;
    }

    return {
      totalRequests,
      totalErrors,
      avgResponseTimeMs,
      totalTokensUsed,
      totalCostUsd,
      toolUsage,
      agentUsage,
      errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
    };
  }
}

export const agentTelemetry = AgentTelemetry.getInstance();
