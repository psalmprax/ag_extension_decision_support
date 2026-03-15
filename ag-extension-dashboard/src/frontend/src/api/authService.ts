import apiClient from './client';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    region?: string;
    phone?: string;
    avatarUrl?: string;
}

export interface AuthResponse {
    success: boolean;
    data: User;
    token?: string;
}

export const fetchUserProfile = async (): Promise<AuthResponse> => {
    const response = await apiClient.get<AuthResponse>('/auth/me');
    return response.data;
};

export const login = async (credentials: any): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
};

export const register = async (userData: any): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', userData);
    return response.data;
};
