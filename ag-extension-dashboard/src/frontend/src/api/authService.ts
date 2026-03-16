import apiClient from './client';

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

export const fetchUserProfile = async (): Promise<AuthResponse> => {
    const response = await apiClient.get<AuthResponse>('/auth/me');
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
