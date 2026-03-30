import axios from 'axios';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface DiseaseAlert {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    crop: string;
    region: string;
    publishedDate: string;
}

export class FAOService {
    private static baseUrl = config.externalApis.fao.url;

    /**
     * Get recent disease alerts for a region/crop
     */
    static async getDiseaseAlerts(region: string, crop?: string): Promise<DiseaseAlert[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/alerts`, {
                params: { region, crop, type: 'disease' },
                timeout: 5000
            });

            if (response.data && response.data.length > 0) {
                return response.data;
            }

            return [];
        } catch (error) {
            logger.error('FAO Disease alerts fetch failed — external API not configured:', error);
            return [];
        }
    }
}
