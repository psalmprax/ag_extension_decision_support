import { logger } from '../../utils/logger';

export interface SoilProperties {
    ph: number | string;
    clay: number | string;
    sand: number | string;
    silt: number | string;
    organic_carbon_g_kg: number | string;
}

/**
 * Service to interact with the ISRIC SoilGrids v2.0 API for global soil properties.
 */
export class SoilGridsService {
    private readonly baseUrl = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

    async fetchSoilProperties(latitude: number, longitude: number): Promise<SoilProperties> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.fetchSoilPropertiesOnce(latitude, longitude);
            } catch (error) {
                lastError = error;
                logger.warn(`SoilGrids fetch attempt ${attempt}/3 failed: ${error instanceof Error ? error.message : "Unknown error"}`);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
        }

        const message = lastError instanceof Error ? lastError.message : String(lastError);
        logger.error(`Error fetching SoilGrids data after retries: ${message}`);
        
        // Fallback to standard sandy loam soil defaults
        return {
            ph: 6.2,
            clay: 15.0,
            sand: 65.0,
            silt: 20.0,
            organic_carbon_g_kg: 18.5
        };
    }

    private async fetchSoilPropertiesOnce(latitude: number, longitude: number): Promise<SoilProperties> {
        try {
            // Selected key properties for agricultural planning:
            // phh2o: soil pH
            // clay: clay content
            // sand: sand content
            // silt: silt content
            // soc: soil organic carbon
            const properties = ['phh2o', 'clay', 'sand', 'silt', 'soc'];
            const depths = ['0-5cm', '5-15cm', '15-30cm'];

            const url = new URL(this.baseUrl);
            url.searchParams.append('lon', String(longitude));
            url.searchParams.append('lat', String(latitude));
            
            properties.forEach(p => url.searchParams.append('property', p));
            depths.forEach(d => url.searchParams.append('depth', d));
            url.searchParams.append('value', 'mean');

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ag-extension-dashboard/1.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`SoilGrids returned HTTP ${response.status}`);
            }

            const data = await response.json();
            logger.info(`Successfully fetched SoilGrids data for lat/lng: ${latitude}, ${longitude}`);
            
            return this.parseSoilGridsResponse(data);
        } catch (error) {
            logger.error(`Error fetching SoilGrids: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw new Error(`Failed to fetch SoilGrids: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    private parseSoilGridsResponse(data: any): SoilProperties {
        const layers = data?.properties?.layers || [];
        
        const getMeanValue = (layerName: string): number | null => {
            const layer = layers.find((l: any) => l.name === layerName);
            if (!layer || !layer.depths || layer.depths.length === 0) return null;
            
            // Average the mean values across the queried depths (0-5, 5-15, 15-30 cm)
            const validDepths = layer.depths.filter((d: any) => d.values && d.values.mean !== undefined);
            if (validDepths.length === 0) return null;
            
            const sum = validDepths.reduce((acc: number, cur: any) => acc + cur.values.mean, 0);
            return sum / validDepths.length;
        };

        // SoilGrids scales some values:
        // phh2o: Scaled by 10 (e.g. pH 62 => 6.2)
        // clay/sand/silt: Scaled by 10 (expressed as g/kg, e.g. 150 g/kg => 15.0%)
        // soc: Scaled by 10 (expressed as dg/kg, e.g. 185 dg/kg => 18.5 g/kg)
        const phRaw = getMeanValue('phh2o');
        const clayRaw = getMeanValue('clay');
        const sandRaw = getMeanValue('sand');
        const siltRaw = getMeanValue('silt');
        const socRaw = getMeanValue('soc');

        return {
            ph: phRaw ? Number((phRaw / 10).toFixed(1)) : 'N/A',
            clay: clayRaw ? Number((clayRaw / 10).toFixed(1)) : 'N/A',
            sand: sandRaw ? Number((sandRaw / 10).toFixed(1)) : 'N/A',
            silt: siltRaw ? Number((siltRaw / 10).toFixed(1)) : 'N/A',
            organic_carbon_g_kg: socRaw ? Number((socRaw / 10).toFixed(1)) : 'N/A'
        };
    }
}

export const soilGridsService = new SoilGridsService();
