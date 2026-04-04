import { z } from 'zod';
import { Tool } from './types';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';

// Define the schema for registering an alert
const RegisterAlertSchema = z.object({
  type: z.enum(['pest', 'disease', 'weather', 'market', 'other']).describe('The category of the alert'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('The severity level of the alert'),
  title: z.string().describe('Clear title for the alert (e.g., "Fall Armyworm Outbreak")'),
  description: z.string().describe('Detailed description of the threat and initial recommendations'),
  location: z.string().describe('The specific region or village affected'),
  affectedFarmers: z.array(z.string()).optional().describe('IDs of specific farmers if known'),
});

/**
 * A tool that allows the AI Advisor to update the system by registering new agricultural alerts.
 * Use this when critical threats are identified through research, weather data, or farmer reports.
 */
export const registerAlertTool: Tool<typeof RegisterAlertSchema> = {
  name: 'register_agricultural_alert',
  description: 'Registers a new system-wide agricultural alert. Use this only for verified or high-probability threats that require attention from extension officers and other farmers.',
  schema: RegisterAlertSchema,
  execute: async ({ type, severity, title, description, location, affectedFarmers }) => {
    logger.info(`AI Advisor registering ${severity} ${type} alert: ${title} in ${location}`);
    
    const pool = getPool();
    if (!pool) {
      return JSON.stringify({
        success: false,
        message: 'Database connection not available. Unable to register alert.',
      });
    }

    try {
      const result = await query(`
        INSERT INTO alerts (type, severity, title, description, location, affected_farmers, is_active, triggered_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
        RETURNING id, title, triggered_at
      `, [type, severity, title, description, location, affectedFarmers || []]);

      return JSON.stringify({
        success: true,
        message: `System successfully updated. Registered ${severity} severity alert: "${title}".`,
        alertId: result.rows[0].id,
      });
    } catch (error) {
      logger.error('Error in registerAlertTool:', error);
      return JSON.stringify({
        success: false,
        message: 'Internal error occurred while registering system alert.',
      });
    }
  },
};
