import apiClient from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const clearAllNotifications = async (): Promise<void> => {
  await apiClient.delete('/notifications');
};
