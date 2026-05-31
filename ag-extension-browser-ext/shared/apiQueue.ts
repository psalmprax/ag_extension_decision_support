// API Queue Service for offline synchronization

export interface QueuedRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    maxRetries?: number;
}

export interface OfflineStatus {
    isOnline: boolean;
    lastChecked: number;
}

class APIQueueService {
    private isOnline: boolean = navigator.onLine;

    constructor() {
        // Listen for online/offline events
        globalThis.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyStatusChange(true);
        });

        globalThis.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyStatusChange(false);
        });

        // Listen for messages from background script
        const browserAPI = browser;
        if (browserAPI?.runtime) {
            browserAPI.runtime.onMessage.addListener((message: any) => {
                if (message.action === 'online_status_changed') {
                    this.isOnline = message.isOnline;
                    this.emit('statusChange', this.isOnline);
                }
            });
        }
    }

    private listeners: { [event: string]: Function[] } = {};

    private emit(event: string, data: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    public on(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    public off(event: string, callback: Function) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    private notifyStatusChange(isOnline: boolean) {
        this.emit('statusChange', isOnline);
    }

    public async isCurrentlyOnline(): Promise<boolean> {
        try {
            const browserAPI = browser;
            if (browserAPI?.runtime) {
                const response = await browserAPI.runtime.sendMessage({ action: 'get_offline_status' });
                if (response.success) {
                    this.isOnline = response.status.isOnline;
                    return this.isOnline;
                }
            }
        } catch (error) {
            console.error('Failed to get offline status:', error);
        }
        return this.isOnline;
    }

    public async queueRequest(request: QueuedRequest): Promise<void> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            throw new Error('Browser API not available');
        }

        const response = await browserAPI.runtime.sendMessage({
            action: 'queue_request',
            request: {
                url: request.url,
                method: request.method,
                headers: request.headers,
                body: request.body,
                maxRetries: request.maxRetries || 3
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to queue request');
        }
    }

    public async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
        const isOnline = await this.isCurrentlyOnline();

        if (!isOnline) {
            // Queue the request
            await this.queueRequest({
                url,
                method: options.method || 'GET',
                headers: (options.headers as Record<string, string>) || {},
                body: options.body,
                maxRetries: 3
            });

            // Return a mock response for offline state
            return new Response(JSON.stringify({
                success: false,
                message: 'Request queued for offline processing',
                queued: true
            }), {
                status: 202,
                statusText: 'Accepted (Queued)',
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Make the request normally
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            // If fetch fails, queue the request
            console.warn('Request failed, queuing for later:', error);
            await this.queueRequest({
                url,
                method: options.method || 'GET',
                headers: (options.headers as Record<string, string>) || {},
                body: options.body,
                maxRetries: 3
            });

            throw error;
        }
    }

    public async getQueuedRequests(): Promise<any[]> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            return [];
        }

        try {
            const response = await browserAPI.runtime.sendMessage({ action: 'get_queued_requests' });
            return response.success ? response.requests : [];
        } catch (error) {
            console.error('Failed to get queued requests:', error);
            return [];
        }
    }

    public async syncNow(): Promise<void> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            throw new Error('Browser API not available');
        }

        const response = await browserAPI.runtime.sendMessage({ action: 'sync_now' });
        if (!response.success) {
            throw new Error(response.error || 'Sync failed');
        }
    }
}

// Export singleton instance
export const apiQueue = new APIQueueService();