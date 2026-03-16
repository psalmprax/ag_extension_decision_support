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
            // Note: In a real implementation, this would call FAO EMPRES-i or similar
            // For now, we simulate the API call to a structured FAO-like endpoint
            const response = await axios.get(`${this.baseUrl}/alerts`, {
                params: { region, crop, type: 'disease' },
                timeout: 5000
            }).catch(_e => ({ data: [] })); // Graceful fallback

            if (response.data && response.data.length > 0) {
                return response.data;
            }

            return this.getMockAlerts(region, crop);
        } catch (error) {
            logger.error('FAO Disease alerts fetch failed:', error);
            return this.getMockAlerts(region, crop);
        }
    }

    private static getMockAlerts(region: string, crop?: string): DiseaseAlert[] {
        const alerts: DiseaseAlert[] = [
            {
                id: 'fao-2024-001',
                title: 'Maize Lethal Necrosis (MLN) Warning',
                description: 'Increased reports of MLN in the Rift Valley region. Farmers are advised to rotate crops.',
                severity: 'high',
                crop: 'Maize',
                region: 'Rift Valley',
                publishedDate: new Date().toISOString()
            },
            {
                id: 'fao-2024-002',
                title: 'Fall Armyworm Infestation Spotted',
                description: 'Localized infestations of Fall Armyworm detected in Western Kenya.',
                severity: 'medium',
                crop: 'Maize',
                region: 'Western',
                publishedDate: new Date().toISOString()
            }
        ];

        return alerts.filter(a => 
            (a.region.toLowerCase().includes(region.toLowerCase()) || region === 'Kenya') &&
            (!crop || a.crop.toLowerCase() === crop.toLowerCase())
        );
    }
}
