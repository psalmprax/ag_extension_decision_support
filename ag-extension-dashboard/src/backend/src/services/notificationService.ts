/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../utils/logger';
import { sendPushNotification } from './pushNotificationService';
import { PrismaClient, Prisma } from '@prisma/client';
import { addNotificationJob } from '../queues/notificationQueue';

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

export type NotificationType =
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

export type NotificationChannel =
    | 'in_app'
    | 'email'
    | 'sms';

export interface NotificationPayload {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    channel: NotificationChannel;
    metadata?: Record<string, unknown>;
}

/**
 * Notification Service
 * Handles in-app, email, and SMS notifications
 */
class NotificationService {
    private twilioSid?: string;
    private twilioToken?: string;
    private twilioPhone?: string;
    private sendgridKey?: string;
    private fromEmail?: string;

    constructor() {
        this.twilioSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioToken = process.env.TWILIO_AUTH_TOKEN;
        this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        this.sendgridKey = process.env.SENDGRID_API_KEY;
        this.fromEmail = process.env.FROM_EMAIL || 'info@gpfed.com';
    }

    /**
     * Send notification through specified channel
     */
    async send(payload: NotificationPayload): Promise<boolean> {
        try {
            switch (payload.channel) {
                case 'in_app':
                    return await this.sendInApp(payload);
                case 'email':
                    return await this.sendEmail(payload);
                case 'sms':
                    return await this.sendSMS(payload);
                default:
                    logger.warn(`Unknown notification channel: ${payload.channel}`);
                    return false;
            }
        } catch (error) {
            logger.error('Failed to send notification:', error);
            return false;
        }
    }

    /**
     * Send in-app notification (store in database)
     */
    private async sendInApp(payload: NotificationPayload): Promise<boolean> {
        try {
            // Store notification in database for in-app display
            await prisma.notification.create({
                data: {
                    userId: payload.userId,
                    type: payload.type,
                    title: payload.title,
                    message: payload.message,
                    channel: payload.channel,
                    metadata: payload.metadata as Prisma.InputJsonValue,
                }
            });

            logger.info(`In-app notification saved and sent to user ${payload.userId}: ${payload.title}`);

            // Also trigger Web Push for in-app notifications
            const metadataUrl = typeof payload.metadata?.url === 'string' ? payload.metadata.url : '/';
            await sendPushNotification(payload.userId, payload.title, payload.message, metadataUrl);

            return true;
        } catch (error) {
            logger.error('Failed to send in-app notification:', error);
            return false;
        }
    }

    /**
     * Send email notification
     */
    private async sendEmail(payload: NotificationPayload): Promise<boolean> {
        if (!this.sendgridKey) {
            logger.warn('SendGrid API key not configured, skipping email');
            return false;
        }

        try {
            // Using SendGrid API
            const sgMail = await import('@sendgrid/mail');
            sgMail.default.setApiKey(this.sendgridKey);

            const msg = {
                to: payload.metadata?.email as string || '',
                from: this.fromEmail!,
                subject: payload.title,
                text: payload.message,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${payload.title}</h2>
            <p style="color: #666; line-height: 1.6;">${payload.message}</p>
            <footer style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
              <p>AG Extension Decision Support</p>
            </footer>
          </div>
        `,
            };

            await sgMail.default.send(msg);
            logger.info(`Email notification sent to ${msg.to}`);
            return true;
        } catch (error) {
            logger.error('Failed to send email notification:', error);
            return false;
        }
    }

    /**
     * Send SMS notification
     */
    private async sendSMS(payload: NotificationPayload): Promise<boolean> {
        if (!this.twilioSid || !this.twilioToken || !this.twilioPhone) {
            logger.warn('Twilio credentials not configured, skipping SMS');
            return false;
        }

        try {
            const phoneNumber = payload.metadata?.phone as string;
            if (!phoneNumber) {
                logger.warn('No phone number provided for SMS');
                return false;
            }

            // Using Twilio API directly via fetch
            const credentials = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString('base64');

            const response = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        To: phoneNumber,
                        From: this.twilioPhone!,
                        Body: `${payload.title}: ${payload.message}`,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                logger.error('Twilio error:', error);
                return false;
            }

            logger.info(`SMS notification sent to ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error('Failed to send SMS notification:', error);
            return false;
        }
    }

    /**
     * Send notification to multiple users
     */
    async broadcast(
        userIds: string[],
        payload: Omit<NotificationPayload, 'userId'>
    ): Promise<{ sent: number; failed: number }> {
        const results = await Promise.allSettled(
            userIds.map(userId => this.send({ ...payload, userId }))
        );

        const sent = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value).length;
        const failed = results.length - sent;

        logger.info(`Broadcast notification: ${sent} sent, ${failed} failed`);
        return { sent, failed };
    }

    /**
     * Schedule notification for later via a BullMQ delayed job.
     *
     * The delayed job is the single durable record: no notification row is written
     * until delivery time, so the user never sees a "scheduled" item early and the
     * worker never creates a duplicate. If the scheduled time is within 60s (or in
     * the past) the notification is sent immediately.
     */
    async schedule(
        payload: NotificationPayload,
        scheduledAt: Date
    ): Promise<boolean> {
        const delayMs = scheduledAt.getTime() - Date.now();
        if (delayMs <= 60_000) {
            return this.send(payload);
        }
        try {
            // BullMQ delayed jobs are capped at 24h here to keep Redis bounded; the
            // worker re-schedules anything further out when it fires.
            const cappedDelay = Math.min(delayMs, 24 * 60 * 60 * 1000);
            await addNotificationJob(
                {
                    ...payload,
                    metadata: { ...payload.metadata, scheduledAt: scheduledAt.toISOString() },
                },
                { delay: cappedDelay }
            );
            logger.info(`Notification for ${payload.userId} scheduled at ${scheduledAt.toISOString()} (in ${Math.round(delayMs / 1000)}s) via BullMQ`);
            return true;
        } catch (error) {
            logger.error('Failed to schedule notification:', error);
            return false;
        }
    }

    /**
     * Like send(), but propagates failures so a queue worker can retry.
     */
    async sendOrThrow(payload: NotificationPayload): Promise<void> {
        let ok = false;
        switch (payload.channel) {
            case 'in_app':
                ok = await this.sendInApp(payload);
                break;
            case 'email':
                ok = await this.sendEmail(payload);
                break;
            case 'sms':
                ok = await this.sendSMS(payload);
                break;
            default:
                throw new Error(`Unknown notification channel: ${payload.channel}`);
        }
        if (!ok) throw new Error(`Notification delivery via ${payload.channel} failed for user ${payload.userId}`);
    }
}

// Export singleton instance
export const notificationService = new NotificationService();
