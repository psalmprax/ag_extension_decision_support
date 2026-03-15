import { z } from 'zod';
import { Tool } from './types';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';

// Define the schema for scheduling a visit
const ScheduleVisitSchema = z.object({
  farmerId: z.string().describe('The database ID of the farmer to visit'),
  scheduledAt: z.string().describe('ISO 8601 timestamp for the visit'),
  visitType: z.enum(['routine', 'follow-up', 'emergency', 'training']).default('routine'),
  notes: z.string().optional().describe('Initial notes or reason for the visit'),
});

/**
 * A tool that schedules a field visit in the database.
 */
export const scheduleVisitTool: Tool<typeof ScheduleVisitSchema> = {
  name: 'schedule_visit',
  description: 'Schedules a new field visit for a farmer. Use this when a farmer requests a visit or when the AI identifies a high-priority need for a face-to-face consultation.',
  schema: ScheduleVisitSchema,
  execute: async ({ farmerId, scheduledAt, visitType, notes }) => {
    logger.info(`Scheduling ${visitType} visit for farmer ${farmerId} at ${scheduledAt}`);
    
    const pool = getPool();
    if (!pool) {
      return JSON.stringify({
        success: false,
        message: 'Database connection not available. Unable to schedule visit.',
      });
    }

    try {
      // Get farmer name for confirmation
      const farmerResult = await query('SELECT first_name, last_name FROM farmers WHERE id = $1', [farmerId]);
      const farmer = farmerResult.rows[0];
      
      if (!farmer) {
        return JSON.stringify({
          success: false,
          message: `Farmer with ID ${farmerId} not found.`,
        });
      }

      const result = await query(`
        INSERT INTO visits (farmer_id, visit_type, status, scheduled_at, notes, created_at)
        VALUES ($1, $2, 'scheduled', $3, $4, NOW())
        RETURNING id
      `, [farmerId, visitType, scheduledAt, notes]);

      return JSON.stringify({
        success: true,
        message: `Successfully scheduled ${visitType} visit for ${farmer.first_name} ${farmer.last_name} on ${new Date(scheduledAt).toLocaleString()}.`,
        visitId: result.rows[0].id,
      });
    } catch (error) {
      logger.error('Error in scheduleVisitTool:', error);
      return JSON.stringify({
        success: false,
        message: 'Internal error occurred while scheduling visit.',
      });
    }
  },
};
