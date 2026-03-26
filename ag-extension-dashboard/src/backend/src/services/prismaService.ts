import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient({
            log: ['warn', 'error'],
            datasourceUrl: process.env.DATABASE_URL,
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
