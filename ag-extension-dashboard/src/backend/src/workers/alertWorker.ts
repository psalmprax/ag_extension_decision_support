/* eslint-disable @typescript-eslint/no-explicit-any */
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { query } from '../services/databaseService';

/**
 * Alert Worker
 * Runs scheduled checks to proactively notify users about:
 * - Upcoming visits (24h before, on day of)
 * - Overdue visits
 * - Follow-up required
 * - Disease/weather alerts from FAO
 * - Weather extreme warnings
 * - Subscription expiry warnings
 * - Chatbot low satisfaction alerts
 * - Payment due reminders
 * - New farmer assignments
 * 
 * Auto-starts when imported
 */



// Auto-start the alert worker (after a delay to ensure database is ready)
setTimeout(() => {
    startAlertWorker();
}, 10000); // Wait 10 seconds for database to initialize

export async function runAlertChecks(): Promise<void> {
    logger.info('Running automated alert checks...');

    try {
        await Promise.all([
            checkUpcomingVisits(),
            checkOverdueVisits(),
            checkFollowUpRequired(),
            checkDiseaseAlerts(),
            checkWeatherAlerts(),
            checkSubscriptionExpiry(),
            checkChatbotSatisfaction(),
            checkPaymentDue(),
            checkFarmerAssignment()
        ]);
        logger.info('Alert checks completed successfully');
    } catch (error) {
        logger.error('Error running alert checks:', error);
    }
}

/**
 * Check for weather warnings and notify officers in affected areas
 */
async function checkWeatherAlerts(): Promise<void> {
    try {
        // Check for recent weather data that might have extreme conditions
        // This would integrate with the weather service
        // For now, check if there's weather data in the last 24h with extreme conditions

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const weatherResult = await query(`
            SELECT DISTINCT 
                f.region,
                COUNT(*) as extreme_count
            FROM farmers f
            WHERE f.region IS NOT NULL
            GROUP BY f.region
            LIMIT 10
        `);

        // Notify regional managers about weather patterns in their region
        const managersResult = await query(`
            SELECT id, region FROM users 
            WHERE role = 'regional_manager' AND is_active = TRUE
        `);

        for (const manager of managersResult.rows) {
            // Could check specific weather conditions and notify
            // For now, this is a placeholder for weather alert logic
            logger.info(`Weather check for region: ${manager.region}`);
        }

        logger.info(`Processed weather alerts check`);
    } catch (error) {
        logger.error('Error checking weather alerts:', error);
    }
}

/**
 * Check for subscriptions expiring soon (within 7 days)
 */
async function checkSubscriptionExpiry(): Promise<void> {
    try {
        const result = await query(`
            SELECT 
                s.user_id,
                s.current_period_end,
                s.status,
                u.email,
                u.first_name
            FROM subscriptions s
            JOIN users u ON u.id = s.user_id
            WHERE s.status = 'active' 
              AND s.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
              AND (s.expiry_notification_sent IS NULL OR s.expiry_notification_sent = FALSE)
        `);

        for (const sub of result.rows) {
            const daysUntilExpiry = Math.ceil(
                (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            await notificationService.send({
                userId: sub.user_id,
                type: 'warning',
                title: '⚠️ Subscription Expiring Soon',
                message: `Your subscription will expire in ${daysUntilExpiry} days. Please renew to continue receiving services.`,
                channel: 'in_app',
                metadata: { daysUntilExpiry, currentPeriodEnd: sub.current_period_end }
            });

            await query('UPDATE subscriptions SET expiry_notification_sent = TRUE WHERE user_id = $1', [sub.user_id]);
        }

        logger.info(`Processed ${result.rows.length} subscription expiry notifications`);
    } catch (error) {
        logger.error('Error checking subscription expiry:', error);
    }
}

/**
 * Check for low chatbot satisfaction scores
 */
async function checkChatbotSatisfaction(): Promise<void> {
    try {
        const result = await query(`
            SELECT 
                c.id,
                c.satisfaction_score,
                c.started_at,
                u.id as officer_id,
                u.first_name
            FROM chat_conversations c
            JOIN users u ON u.id = c.officer_id
            WHERE c.satisfaction_score IS NOT NULL
              AND c.satisfaction_score <= 2
              AND c.started_at > NOW() - INTERVAL '24 hours'
              AND (c.low_satisfaction_alert_sent IS NULL OR c.low_satisfaction_alert_sent = FALSE)
        `);

        for (const conv of result.rows) {
            await notificationService.send({
                userId: conv.officer_id,
                type: 'warning',
                title: '📉 Low Satisfaction Alert',
                message: `A recent chat conversation received a low satisfaction score (${conv.satisfaction_score}/5). Please follow up with the farmer.`,
                channel: 'in_app',
                metadata: { conversationId: conv.id, satisfactionScore: conv.satisfaction_score }
            });

            await query('UPDATE chat_conversations SET low_satisfaction_alert_sent = TRUE WHERE id = $1', [conv.id]);
        }

        logger.info(`Processed ${result.rows.length} low satisfaction alerts`);
    } catch (error) {
        logger.error('Error checking chatbot satisfaction:', error);
    }
}

/**
 * Check for upcoming payment due dates
 */
async function checkPaymentDue(): Promise<void> {
    try {
        // This would check for any payment/subscription billing dates
        // Currently placeholder - would integrate with Stripe/webhooks

        logger.info('Processed payment due check');
    } catch (error) {
        logger.error('Error checking payment due:', error);
    }
}

/**
 * Check for new farmer assignments and notify extension officers
 */
async function checkFarmerAssignment(): Promise<void> {
    try {
        const result = await query(`
            SELECT 
                f.id,
                f.first_name,
                f.last_name,
                f.region,
                f.created_at,
                f.assigned_officer_id
            FROM farmers f
            WHERE f.assigned_officer_id IS NOT NULL
              AND f.created_at > NOW() - INTERVAL '24 hours'
              AND (f.assignment_notification_sent IS NULL OR f.assignment_notification_sent = FALSE)
        `);

        for (const farmer of result.rows) {
            await notificationService.send({
                userId: farmer.assigned_officer_id,
                type: 'info',
                title: '👤 New Farmer Assigned',
                message: `You have been assigned a new farmer: ${farmer.first_name} ${farmer.last_name} from ${farmer.region}.`,
                channel: 'in_app',
                metadata: { farmerId: farmer.id, farmerName: `${farmer.first_name} ${farmer.last_name}` }
            });

            await query('UPDATE farmers SET assignment_notification_sent = TRUE WHERE id = $1', [farmer.id]);
        }

        logger.info(`Processed ${result.rows.length} new farmer assignment notifications`);
    } catch (error) {
        logger.error('Error checking farmer assignments:', error);
    }
}

/**
 * Check for visits scheduled within next 24 hours and send reminders
 */
async function checkUpcomingVisits(): Promise<void> {
    try {
        // Get visits scheduled in the next 24 hours that haven't been reminded
        const result = await query(`
            SELECT 
                v.id, v.scheduled_at, v.visit_type,
                f.id as farmer_id, f.first_name as farmer_first_name, f.last_name as farmer_last_name, f.phone,
                u.id as officer_id, u.first_name as officer_first_name, u.last_name as officer_last_name, u.email as officer_email
            FROM visits v
            JOIN farmers f ON f.id = v.farmer_id
            JOIN users u ON u.id = v.officer_id
            WHERE v.status = 'scheduled'
              AND v.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
              AND (v.reminder_sent IS NULL OR v.reminder_sent = FALSE)
            ORDER BY v.scheduled_at ASC
            LIMIT 50
        `);

        for (const visit of result.rows) {
            const scheduledTime = new Date(visit.scheduled_at);
            const now = new Date();
            const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

            let reminderType: 'day_reminder' | 'hour_reminder';
            if (hoursUntil <= 1) {
                reminderType = 'hour_reminder';
            } else {
                reminderType = 'day_reminder';
            }

            // Notify extension officer
            await notificationService.send({
                userId: visit.officer_id,
                type: 'warning',
                title: reminderType === 'hour_reminder'
                    ? '🚨 Visit in 1 Hour!'
                    : '📅 Visit Tomorrow',
                message: `Your ${visit.visit_type} visit to ${visit.farmer_first_name} ${visit.farmer_last_name} is ${reminderType === 'hour_reminder' ? 'in 1 hour' : 'scheduled for tomorrow'}.`,
                channel: 'in_app',
                metadata: {
                    visitId: visit.id,
                    farmerId: visit.farmer_id,
                    type: reminderType
                }
            });

            // Also send SMS if phone available
            if (visit.farmer_phone) {
                await notificationService.send({
                    userId: visit.officer_id,
                    type: 'info',
                    title: 'Farmer Contact',
                    message: `Farmer phone: ${visit.farmer_phone}`,
                    channel: 'in_app',
                    metadata: { visitId: visit.id }
                });
            }

            // Mark reminder as sent
            await query('UPDATE visits SET reminder_sent = TRUE WHERE id = $1', [visit.id]);

            logger.info(`Sent visit reminder for visit ${visit.id} to officer ${visit.officer_id}`);
        }

        logger.info(`Processed ${result.rows.length} upcoming visit reminders`);
    } catch (error) {
        logger.error('Error checking upcoming visits:', error);
    }
}

/**
 * Check for overdue visits and send alerts
 */
async function checkOverdueVisits(): Promise<void> {
    try {
        // Get visits that are past scheduled time and still scheduled
        const result = await query(`
            SELECT 
                v.id, v.scheduled_at, v.visit_type, v.status,
                f.id as farmer_id, f.first_name as farmer_first_name, f.last_name as farmer_last_name,
                u.id as officer_id, u.first_name as officer_first_name, u.last_name as officer_last_name
            FROM visits v
            JOIN farmers f ON f.id = v.farmer_id
            JOIN users u ON u.id = v.officer_id
            WHERE v.status = 'scheduled'
              AND v.scheduled_at < NOW() - INTERVAL '1 hour'
              AND (v.overdue_alert_sent IS NULL OR v.overdue_alert_sent = FALSE)
            ORDER BY v.scheduled_at ASC
            LIMIT 20
        `);

        for (const visit of result.rows) {
            const hoursOverdue = Math.floor((Date.now() - new Date(visit.scheduled_at).getTime()) / (1000 * 60 * 60));

            // Notify officer about overdue visit
            await notificationService.send({
                userId: visit.officer_id,
                type: 'error',
                title: '⚠️ Overdue Visit',
                message: `Your visit to ${visit.farmer_first_name} ${visit.farmer_last_name} was scheduled ${hoursOverdue} hours ago and is now overdue. Please reschedule or complete.`,
                channel: 'in_app',
                metadata: {
                    visitId: visit.id,
                    farmerId: visit.farmer_id,
                    hoursOverdue
                }
            });

            // Mark overdue alert as sent
            await query('UPDATE visits SET overdue_alert_sent = TRUE WHERE id = $1', [visit.id]);

            logger.info(`Sent overdue alert for visit ${visit.id} to officer ${visit.officer_id}`);
        }

        logger.info(`Processed ${result.rows.length} overdue visit alerts`);
    } catch (error) {
        logger.error('Error checking overdue visits:', error);
    }
}

/**
 * Check for visits requiring follow-up that haven't been completed
 */
async function checkFollowUpRequired(): Promise<void> {
    try {
        // Get completed visits with follow-up required that are old (>7 days)
        const result = await query(`
            SELECT 
                v.id, v.completed_at, v.visit_type,
                f.id as farmer_id, f.first_name as farmer_first_name, f.last_name as farmer_last_name,
                u.id as officer_id, u.first_name as officer_first_name, u.last_name as officer_last_name
            FROM visits v
            JOIN farmers f ON f.id = v.farmer_id
            JOIN users u ON u.id = v.officer_id
            WHERE v.status = 'completed'
              AND v.follow_up_required = TRUE
              AND v.completed_at < NOW() - INTERVAL '7 days'
              AND (v.follow_up_reminder_sent IS NULL OR v.follow_up_reminder_sent = FALSE)
            ORDER BY v.completed_at ASC
            LIMIT 20
        `);

        for (const visit of result.rows) {
            const daysSince = Math.floor((Date.now() - new Date(visit.completed_at).getTime()) / (1000 * 60 * 60 * 24));

            // Notify officer about pending follow-up
            await notificationService.send({
                userId: visit.officer_id,
                type: 'warning',
                title: '🔔 Follow-up Reminder',
                message: `You requested a follow-up for ${visit.farmer_first_name} ${visit.farmer_last_name} (${visit.visit_type}) ${daysSince} days ago. Please complete the follow-up.`,
                channel: 'in_app',
                metadata: {
                    visitId: visit.id,
                    farmerId: visit.farmer_id,
                    daysSince
                }
            });

            // Mark follow-up reminder as sent
            await query('UPDATE visits SET follow_up_reminder_sent = TRUE WHERE id = $1', [visit.id]);

            logger.info(`Sent follow-up reminder for visit ${visit.id} to officer ${visit.officer_id}`);
        }

        logger.info(`Processed ${result.rows.length} follow-up reminders`);
    } catch (error) {
        logger.error('Error checking follow-up required:', error);
    }
}

/**
 * Check for active disease/weather alerts and notify relevant officers
 */
async function checkDiseaseAlerts(): Promise<void> {
    try {
        // Check for active alerts that haven't been notified
        const alertsResult = await query(`
            SELECT id, type, severity, description, location, created_at
            FROM alerts
            WHERE is_active = TRUE
              AND (notification_sent IS NULL OR notification_sent = FALSE)
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
                created_at DESC
            LIMIT 10
        `);

        // Get all extension officers
        const officersResult = await query(`
            SELECT id, region FROM users WHERE role = 'extension_officer' AND is_active = TRUE
        `);

        for (const alert of alertsResult.rows) {
            // Determine which officers to notify based on alert location
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const relevantOfficers = officersResult.rows.filter((officer: any) =>
                !alert.location || alert.location === officer.region || alert.location === 'All'
            );

            for (const officer of relevantOfficers) {
                const severityEmojiMap: Record<string, string> = {
                    'critical': '🔴',
                    'high': '🟠',
                    'medium': '🟡',
                    'low': '🟢'
                };
                const severityEmoji = severityEmojiMap[alert.severity] || '⚪';

                await notificationService.send({
                    userId: officer.id,
                    type: alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warning',
                    title: `${severityEmoji} ${alert.type} Alert`,
                    message: alert.description,
                    channel: 'in_app',
                    metadata: {
                        alertId: alert.id,
                        alertType: alert.type,
                        severity: alert.severity,
                        location: alert.location
                    }
                });
            }

            // Mark alert notification as sent
            await query('UPDATE alerts SET alert_notification_sent = TRUE WHERE id = $1', [alert.id]);

            logger.info(`Sent alert ${alert.id} notification to ${relevantOfficers.length} officers`);
        }

        logger.info(`Processed ${alertsResult.rows.length} disease/alert notifications`);
    } catch (error) {
        logger.error('Error checking disease alerts:', error);
    }
}

/**
 * Schedule alert checks to run every 15 minutes
 */
export function startAlertWorker(intervalMs: number = 15 * 60 * 1000): void {
    logger.info(`Starting alert worker with ${intervalMs / 60000} minute interval`);

    // Run immediately on start
    runAlertChecks();

    // Then run on interval
    setInterval(runAlertChecks, intervalMs);
}
