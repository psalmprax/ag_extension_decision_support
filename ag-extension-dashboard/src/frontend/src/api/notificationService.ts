import apiClient from './client';

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: Record<string, any>;
    isRead: boolean;
    channel: string;
    createdAt: string;
    readAt: string | null;
}

export const fetchNotifications = async (): Promise<Notification[]> => {
    const { data } = await apiClient.get('/notifications');
    return data.data;
};

export const fetchUnreadCount = async (): Promise<number> => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data.data.count;
};

export const markAsRead = async (notificationId: string): Promise<void> => {
    await apiClient.put(`/notifications/${notificationId}/read`);
};

export const markAllAsRead = async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
    await apiClient.delete(`/notifications/${notificationId}`);
};

export const clearAllNotifications = async (): Promise<void> => {
    await apiClient.delete('/notifications');
};

// Admin functions
export const sendNotification = async (params: {
    userId: string;
    type?: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
}): Promise<void> => {
    await apiClient.post('/notifications/send', params);
};

export const broadcastNotification = async (params: {
    type?: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    role?: string;
}): Promise<{ sent: number }> => {
    const { data } = await apiClient.post('/notifications/broadcast', params);
    return data.data;
};
