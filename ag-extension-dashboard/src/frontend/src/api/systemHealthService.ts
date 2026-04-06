import apiClient from './client';

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

export const fetchHealthStatus = async (): Promise<{ success: boolean; data: HealthCheck[] }> => {
    const response = await apiClient.get('/system/health/components');
    return response.data;
};

export const fetchRecoveryLog = async (): Promise<{ success: boolean; data: RecoveryAction[] }> => {
    const response = await apiClient.get('/system/health/recovery-log');
    return response.data;
};

export const triggerRecovery = async (component: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/system/health/recover/${component}`);
    return response.data;
};
