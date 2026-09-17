import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient({
            log: ['warn', 'error'],
            datasourceUrl: config.database.url,
        });
    }
    return prisma;
}

export async function disconnectPrisma(): Promise<void> {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
        logger.info('Prisma disconnected');
    }
}
