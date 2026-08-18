import apiClient from './client';
import type { Notification } from '@ag-extension/shared/api';

// Canonical shape comes from the shared API contract (@ag-extension/shared/api).
export type { Notification };

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
