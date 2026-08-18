/**
 * Shared API contract — notifications (`/api/v1/notifications`).
 * Includes the in-app notification entity, the unread-count response, and the
 * Web Push subscription payload accepted by `/subscribe`.
 */
import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  isRead: z.boolean(),
  channel: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export const notificationListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(notificationSchema),
});

export const unreadCountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    count: z.number(),
  }),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;
