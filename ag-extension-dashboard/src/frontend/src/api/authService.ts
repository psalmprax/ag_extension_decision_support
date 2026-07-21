import apiClient from '@/api/client';

export type UserRole = 'admin' | 'extension_officer' | 'farmer';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  region?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  // Support legacy/flat structures
  user?: User;
  token?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: User;
}

export const fetchUserProfile = async (): Promise<ProfileResponse> => {
  const response = await apiClient.get<ProfileResponse>('/auth/me');
  return response.data;
};

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  region?: string;
}

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
