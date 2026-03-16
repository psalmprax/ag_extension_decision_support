import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 5000, // 5 second timeout
});

// Request interceptor to add JWT token to all requests
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Global error handler for API calls
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // Handle 401 - redirect to login
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Use window.location for redirect to ensure it works from anywhere
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }

        // Only log warnings in development
        if (import.meta.env.DEV) {
            // Suppress connection refused errors - they're expected when backend isn't running
            if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Silent - backend not running
            }
            // Log other errors
            else if (error.response) {
                console.warn(`API Error: ${error.response.status} - ${error.response.statusText}`);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
