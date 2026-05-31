import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

export class SystemConfigService {
    async get(key: string): Promise<string | null> {
        try {
            const prisma = getPrisma();
            if (!prisma) return null;
            const config = await prisma.systemConfig.findUnique({
                where: { key },
            });
            return config ? config.value : null;
        } catch (error) {
            logger.error(`Failed to get system config for key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: string, isSecret: boolean = false): Promise<boolean> {
        try {
            const prisma = getPrisma();
            if (!prisma) return false;
            await prisma.systemConfig.upsert({
                where: { key },
                update: { value, isSecret, updatedAt: new Date() },
                create: { key, value, isSecret },
            });
            return true;
        } catch (error) {
            logger.error(`Failed to set system config for key ${key}:`, error);
            return false;
        }
    }

    async getStripeKey(): Promise<string | null> {
        const key = await this.get('STRIPE_SECRET_KEY');
        return key || process.env.STRIPE_SECRET_KEY || null;
    }

    async getPayPalKey(): Promise<string | null> {
        const key = await this.get('PAYPAL_CLIENT_ID');
        return key || process.env.PAYPAL_CLIENT_ID || null;
    }
}

export const systemConfigService = new SystemConfigService();
