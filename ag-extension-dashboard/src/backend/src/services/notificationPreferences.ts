import { query } from './databaseService';
import { logger } from '@/utils/logger';

/**
 * A user's alert channel choices from Settings. A missing key means "on", so
 * users who never opened Settings keep receiving alerts.
 */
export interface NotificationPreferences {
    emailAlerts?: boolean;
    smsAlerts?: boolean;
    pushNotifications?: boolean;
}

export type PreferenceChannel = 'email' | 'sms' | 'push';

const KEY: Record<PreferenceChannel, keyof NotificationPreferences> = {
    email: 'emailAlerts',
    sms: 'smsAlerts',
    push: 'pushNotifications',
};

/** True unless the user switched this channel off. */
export function channelAllowed(prefs: NotificationPreferences | null | undefined, channel: PreferenceChannel): boolean {
    return prefs?.[KEY[channel]] !== false;
}

/**
 * The user's saved preferences, or null when none are saved or they cannot be
 * read. A failed lookup is logged and treated as "all channels on": an alert
 * that arrives despite a preference is better than one silently lost.
 */
export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
        const result = await query<{ notification_preferences: NotificationPreferences | null }>(
            'SELECT notification_preferences FROM users WHERE id = $1',
            [userId],
        );
        return result.rows[0]?.notification_preferences ?? null;
    } catch (error) {
        logger.warn(`Could not read notification preferences for user ${userId}; sending on all channels`, error);
        return null;
    }
}
