import { z } from 'zod';
import { Tool } from './types';
import { FAOService } from '@/services/faoService';
import { logger } from '@/utils/logger';

// Define the schema for disease alerts tool
const DiseaseAlertSchema = z.object({
  region: z.string().describe('The agricultural region to check (e.g., "Central Region", "Lilongwe")'),
  crop: z.string().optional().describe('Specific crop type to filter by (e.g., "Maize")'),
});

/**
 * Production-anomaly proxy for disease/pest pressure.
 *
 * This is NOT a live FAO/GIEWS alert feed. It compares FAOSTAT annual production for
 * the two most recent available years and flags crops whose output fell sharply.
 * FAOSTAT lags 1-2 years, so "no alerts" usually means "no recent data", not "safe".
 */
export const diseaseAlertTool: Tool<typeof DiseaseAlertSchema> = {
  name: 'get_disease_alerts',
  description: 'Returns a crop-production anomaly signal derived from FAOSTAT annual statistics (a lagging proxy for disease/pest pressure, NOT real-time alerts). Use for background context only; tell the user that live field scouting and national plant-protection bulletins are the authoritative source.',
  schema: DiseaseAlertSchema,
  execute: async ({ region, crop }) => {
    logger.info(`AI Advisor fetching disease alerts for region: ${region}${crop ? `, crop: ${crop}` : ''}`);

    try {
      const alerts = await FAOService.getDiseaseAlerts(region, crop);
      
      if (alerts.length === 0) {
        return JSON.stringify({
          success: true,
          alerts: [],
          dataStatus: 'faostat_yield_anomaly_proxy',
          message: `No FAOSTAT production anomaly detected for "${region}"${crop ? ` (${crop})` : ''}. This is a lagging statistical proxy (1–2 year delay) and does not confirm the absence of current disease or pest pressure.`,
        });
      }

      return JSON.stringify({
        success: true,
        dataStatus: 'faostat_yield_anomaly_proxy',
        alerts: alerts,
        message: `${alerts.length} production anomaly signal(s) for "${region}" derived from FAOSTAT year-over-year declines. Verify against current field scouting before acting.`
      });
    } catch (error) {
      logger.error('Error in diseaseAlertTool:', error);
      return JSON.stringify({
        success: false,
        dataStatus: 'unavailable',
        message: 'FAOSTAT lookup failed; no anomaly signal is available. Do not infer safety from this.'
      });
    }
  },
};
