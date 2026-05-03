import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRY_BACKOFF = 2; // Exponential backoff multiplier

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 300000, // Explicitly set 5m timeout for AI/RAG queries on CPU
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

// Retry configuration for specific HTTP methods and status codes
const shouldRetry = (error: AxiosError): boolean => {
    const config = error.config;
    if (!config) return false;

    // Don't retry if retry count exceeds max or if it's a non-idempotent method with a body
    const retryCount = (config as any).__retryCount || 0;
    if (retryCount >= MAX_RETRIES) return false;

    // Only retry on specific status codes
    const retryStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.response && retryStatusCodes.includes(error.response.status)) {
        return true;
    }

    // Retry on network errors
    if (!error.response && error.code !== 'ECONNABORTED') {
        return true;
    }

    return false;
};

// Calculate retry delay with exponential backoff
const getRetryDelay = (retryCount: number): number => {
    return RETRY_DELAY * Math.pow(RETRY_BACKOFF, retryCount);
};

// Global error handler for API calls with retry logic
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const config = error.config;

        // Handle 401 - redirect to login
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Dispatch event for App component to clear Zustand state
            window.dispatchEvent(new Event('auth-unauthorized'));
            
            // Use window.location for redirect to ensure it works from anywhere
            const publicRoutes = ['/login', '/register', '/forgot-password'];
            if (!publicRoutes.includes(window.location.pathname)) {
                window.location.href = '/login';
            }
            // Return a never-resolving promise to prevent React Query from retrying
            // This avoids duplicate 401 errors in console
            return new Promise(() => {});
        }

        // Check if we should retry
        if (config && shouldRetry(error)) {
            const retryCount = (config as any).__retryCount || 0;
            (config as any).__retryCount = retryCount + 1;

            const delay = getRetryDelay(retryCount);

            // Log retry attempt in development
            if (import.meta.env.DEV) {
                console.log(`Retry attempt ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms`);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));

            // Retry the request
            return apiClient(config);
        }

        // Only log warnings in development
        if (import.meta.env.DEV) {
            // Suppress connection refused errors - they're expected when backend isn't running
            if (error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Silent - backend not running
            }
            // Suppress noisy configuration warnings
            else if (error.response?.data && (error.response.data as any).errorCode === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
                // Silent - expected setup state
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
