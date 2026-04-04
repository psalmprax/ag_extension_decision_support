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
 * A tool that fetches real-time agricultural disease and pest alerts from the FAO Global Information and Early Warning System.
 */
export const diseaseAlertTool: Tool<typeof DiseaseAlertSchema> = {
  name: 'get_disease_alerts',
  description: 'Fetches active disease, pest, and climate alerts from the FAO for a specific region. Use this to warn extension officers about imminent threats to their assigned farmers.',
  schema: DiseaseAlertSchema,
  execute: async ({ region, crop }) => {
    logger.info(`AI Advisor fetching disease alerts for region: ${region}${crop ? `, crop: ${crop}` : ''}`);

    try {
      const alerts = await FAOService.getDiseaseAlerts(region, crop);
      
      if (alerts.length === 0) {
        return `No critical disease or pest alerts found for the "${region}" region${crop ? ` regarding "${crop}"` : ''}. Situation is currently stable.`;
      }

      return JSON.stringify({
        success: true,
        alerts: alerts,
        message: `Retrieved ${alerts.length} active alerts for the "${region}" region.`
      });
    } catch (error) {
      logger.error('Error in diseaseAlertTool:', error);
      return JSON.stringify({
        success: false,
        message: 'FAO Alert synchronization failed. Internal monitoring should be used as a fallback.'
      });
    }
  },
};
