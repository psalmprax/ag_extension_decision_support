import apiClient from '@/api/client';
import type {
  AuthResponse,
  LoginCredentials,
  MeResponse,
  RegisterData,
  User,
  UserRole,
} from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { AuthResponse, LoginCredentials, RegisterData, User, UserRole };
export type ProfileResponse = MeResponse;

export const fetchUserProfile = async (): Promise<ProfileResponse> => {
  const response = await apiClient.get<ProfileResponse>('/auth/me');
  return response.data;
};

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return response.data;
};

export const register = async (userData: RegisterData): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/register', userData);
  return response.data;
};

export const demoLogin = async (): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/demo');
  return response.data;
};

export const requestPasswordReset = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

export interface LoginHistoryItem {
  id: string;
  userId: string | null;
  email: string;
  status: 'success' | 'failed';
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  location: string | null;
  createdAt: string;
}

export interface LoginStats {
  totalLogins: number;
  successfulLogins: number;
  failedAttempts24h: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export const fetchLoginHistory = async (params?: {
  userId?: string;
  email?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: LoginHistoryItem[]; total: number }> => {
  const response = await apiClient.get<{ success: boolean; data: { items: LoginHistoryItem[]; total: number } }>(
    '/auth/login-history',
    { params }
  );
  return response.data.data;
};

export const fetchLoginStats = async (userId?: string): Promise<LoginStats> => {
  const response = await apiClient.get<{ success: boolean; data: LoginStats }>('/auth/login-stats', {
    params: userId ? { userId } : undefined,
  });
  return response.data.data;
};

export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Logout best-effort
  }
};

