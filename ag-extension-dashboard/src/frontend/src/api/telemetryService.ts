import apiClient from './client';

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

export interface TelemetryEvent {
    id: string;
    eventType: string;
    agentId?: string;
    toolName?: string;
    userId?: string;
    durationMs?: number;
    tokensUsed?: number;
    costUsd?: number;
    status: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
}

export const fetchTelemetrySummary = async (hours = 24): Promise<{ success: boolean; data: TelemetrySummary }> => {
    const response = await apiClient.get(`/ai/telemetry/summary?hours=${hours}`);
    return response.data;
};

export const fetchTelemetryEvents = async (limit = 50): Promise<{ success: boolean; data: TelemetryEvent[] }> => {
    const response = await apiClient.get(`/ai/telemetry/events?limit=${limit}`);
    return response.data;
};
