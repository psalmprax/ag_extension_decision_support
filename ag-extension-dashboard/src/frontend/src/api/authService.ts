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

export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Logout best-effort
  }
};
