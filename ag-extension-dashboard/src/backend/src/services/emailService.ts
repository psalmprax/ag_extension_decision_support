import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';
import { addEmailJob } from '../queues/emailQueue';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    useQueue?: boolean;
}

class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        // Create transporter based on environment
        if (process.env.SMTP_HOST) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            logger.info('Email service initialized with SMTP');
        } else if (process.env.EMAIL_SERVICE === 'sendgrid') {
            // SendGrid transport
            this.transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY,
                },
            });
            logger.info('Email service initialized with SendGrid');
        } else if (process.env.EMAIL_SERVICE === 'mailgun') {
            // Mailgun transport
            this.transporter = nodemailer.createTransport({
                host: 'smtp.mailgun.org',
                port: 587,
                auth: {
                    user: process.env.MAILGUN_USER,
                    pass: process.env.MAILGUN_PASS,
                },
            });
            logger.info('Email service initialized with Mailgun');
        } else if (process.env.AWS_SES_REGION) {
            // AWS SES transport
            this.transporter = nodemailer.createTransport({
                host: `email.${process.env.AWS_SES_REGION}.amazonaws.com`,
                port: 587,
                auth: {
                    user: process.env.AWS_ACCESS_KEY_ID,
                    pass: process.env.AWS_SECRET_ACCESS_KEY,
                },
            });
            logger.info('Email service initialized with AWS SES');
        } else {
            // Development mode - log emails
            logger.warn('Email service not configured. Emails will be logged only.');
        }
    }

    async sendEmail(options: EmailOptions): Promise<boolean> {
        const { to, subject, html, text, useQueue = true } = options;

        // If useQueue is true and we're not already in a worker (or explicitly requested direct), add to queue
        if (useQueue && config.nodeEnv !== 'test') {
            try {
                await addEmailJob({
                    to: Array.isArray(to) ? to[0] : to, // BullMQ job data usually prefers single strings for 'to' if not handled specially
                    subject,
                    text: text || this.stripHtml(html),
                    html
                });
                return true;
            } catch (error) {
                logger.error('Failed to queue email:', error);
                // Fallback to direct sending if queue fails? Better to just fail and let the caller handle it
            }
        }

        return this.sendDirect(options);
    }

    async sendDirect(options: EmailOptions): Promise<boolean> {
        const { to, subject, html, text } = options;
        const recipients = Array.isArray(to) ? to.join(', ') : to;

        if (!this.transporter) {
            if (config.nodeEnv === 'production') {
                logger.error(`Email not sent — no SMTP/SendGrid configured (production guard): To=${recipients}, Subject=${subject}`);
                return false;
            }
            logger.info(`[DEV EMAIL] To: ${recipients}, Subject: ${subject}`);
            return true;
        }

        try {
            const result = await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || '"GPExts" <info@gpfed.com>',
                to: recipients,
                subject,
                html,
                text: text || this.stripHtml(html),
            });

            logger.info(`Email sent successfully: ${result.messageId}`);
            return true;
        } catch (error) {
            logger.error('Failed to send email:', error);
            return false;
        }
    }

    // Helper methods for common email types
    async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
        return this.sendEmail({
            to: email,
            subject: 'Welcome to GPExts',
            html: `
        <h1>Welcome, ${name}!</h1>
        <p>Thank you for joining GPExts.</p>
        <p>Get started by exploring your dashboard.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}">Go to Dashboard</a>
      `,
        });
    }

    async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`;

        return this.sendEmail({
            to: email,
            subject: 'Reset Your Password',
            html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
        });
    }

    async sendVisitReminderEmail(email: string, farmerName: string, visitDate: Date): Promise<boolean> {
        return this.sendEmail({
            to: email,
            subject: 'Visit Reminder',
            html: `
        <h1>Visit Reminder</h1>
        <p>You have a scheduled visit with ${farmerName}</p>
        <p>Date: ${visitDate.toLocaleString()}</p>
      `,
        });
    }

    async sendWeeklyReportEmail(email: string, region: string, reportUrl: string): Promise<boolean> {
        return this.sendEmail({
            to: email,
            subject: `Weekly Report - ${region}`,
            html: `
        <h1>Weekly Report Available</h1>
        <p>Your weekly report for ${region} is ready.</p>
        <a href="${reportUrl}">View Report</a>
      `,
        });
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }
}

export const emailService = new EmailService();
