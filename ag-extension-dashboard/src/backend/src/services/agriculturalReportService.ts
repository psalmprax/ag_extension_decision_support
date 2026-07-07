import { AIProviderFactory } from './aiProvider/aiProvider';
import { marketPriceService } from './marketPriceService';
import { WeatherService } from './weatherService';
import { SatelliteService } from './satelliteService';
import { smsService } from './smsService';
import { emailService } from './emailService';
import { whatsappService } from './whatsappService';
import { logger } from '../utils/logger';
import { getPrisma } from './prismaService';

export interface FarmerNotificationPrefs {
    farmerId: string;
    name: string;
    phone: string;
    email: string;
    whatsapp: string;
    location: string;
    lat: number;
    lng: number;
    crops: string[];
    channels: {
        sms: boolean;
        email: boolean;
        whatsapp: boolean;
    };
}

export class AgriculturalReportService {
    /**
     * Generate and distribute daily agricultural reports to all registered farmers.
     */
    static async generateDailyReports() {
        try {
            logger.info('Starting daily agricultural report generation...');

            // Fetch farmers with active notification preferences
            // This is a mocked fetch, assuming Prisma usage.
            const farmers: FarmerNotificationPrefs[] = await this.getFarmersWithPreferences();

            for (const farmer of farmers) {
                await this.generateAndSendReport(farmer);
            }

            logger.info('Finished daily agricultural report generation.');
        } catch (error) {
            logger.error('Error generating daily reports:', error);
            throw error;
        }
    }

    /**
     * Generate report for a single farmer based on their location and crops,
     * then send it via their preferred channels.
     */
    static async generateAndSendReport(farmer: FarmerNotificationPrefs) {
        try {
            // 1. Fetch raw data
            const [weather, prices, ndvi] = await Promise.all([
                WeatherService.getByLocation(farmer.location).catch(() => null),
                marketPriceService.getLatestPrices().catch(() => []),
                SatelliteService.getSpectralIndices(farmer.lat, farmer.lng).catch(() => [])
            ]);

            // Filter prices for farmer's crops
            const relevantPrices = prices.filter((p: unknown) => {
                const commodity = (p as { commodity?: string })?.commodity;
                return commodity && farmer.crops.includes(commodity);
            });

            // 2. Synthesize with LLM
            const provider = await AIProviderFactory.getPrimaryProvider();
            
            const prompt = `
                You are an expert agricultural advisor. Generate a short, actionable daily briefing for a farmer.
                Farmer Name: ${farmer.name}
                Location: ${farmer.location}
                Crops: ${farmer.crops.join(', ')}
                
                Data context:
                - Weather: ${JSON.stringify(weather)}
                - Market Prices: ${JSON.stringify(relevantPrices)}
                - NDVI/Satellite Data: ${JSON.stringify(ndvi)}
                
                Please format the response as a friendly text message (max 200 words) with key actionable advice for today.
            `;

            const aiResponse = await provider.generateText(prompt);
            const reportContent = aiResponse.text;
            if (!reportContent) {
                logger.warn(`No report content generated for farmer ${farmer.farmerId}`);
                return;
            }

            // 3. Distribute via preferred channels
            if (farmer.channels.sms && farmer.phone) {
                await smsService.sendSMS({
                    to: farmer.phone,
                    message: reportContent,
                    farmerId: farmer.farmerId
                }).catch(e => logger.warn(`Failed to send SMS to ${farmer.farmerId}:`, e));
            }

            if (farmer.channels.whatsapp && farmer.whatsapp) {
                await whatsappService.sendMessage({
                    to: farmer.whatsapp,
                    message: reportContent,
                    farmerId: farmer.farmerId
                }).catch(e => logger.warn(`Failed to send WhatsApp to ${farmer.farmerId}:`, e));
            }

            if (farmer.channels.email && farmer.email) {
                await emailService.sendEmail({
                    to: farmer.email,
                    subject: 'Your Daily Agricultural Advisory Report',
                    html: `<p>Hello ${farmer.name},</p><p>${reportContent.replace(/\\n/g, '<br/>')}</p>`
                }).catch(e => logger.warn(`Failed to send Email to ${farmer.farmerId}:`, e));
            }

        } catch (error) {
            logger.error(`Error generating report for farmer ${farmer.farmerId}:`, error);
        }
    }

    /**
     * Fetch active farmers from the database
     */
    private static async getFarmersWithPreferences(): Promise<FarmerNotificationPrefs[]> {
        const prisma = getPrisma();
        
        // Fetch active farmers who have a phone or email configured
        const activeFarmers = await prisma.farmer.findMany({
            where: {
                isActive: true,
                OR: [
                    { phone: { not: null } },
                    { user: { isNot: null } }
                ]
            },
            include: {
                user: true
            }
        });

        return activeFarmers.map(farmer => ({
            farmerId: farmer.id,
            name: `${farmer.firstName} ${farmer.lastName}`,
            phone: farmer.phone || '',
            email: farmer.user?.email || '',
            whatsapp: farmer.phone || '', // Assuming whatsapp uses the same phone number
            location: farmer.location || 'Unknown Location',
            lat: farmer.locationLat ? Number(farmer.locationLat) : 0,
            lng: farmer.locationLng ? Number(farmer.locationLng) : 0,
            crops: farmer.crops || [],
            channels: { 
                sms: !!farmer.phone, 
                email: !!farmer.user?.email, 
                whatsapp: !!farmer.phone 
            }
        }));
    }
}
