/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';
import { emailService } from './emailService';
import { smsService } from './smsService';
import { getPrisma } from './prismaService';

export interface CreateShareOptions {
    entityType: 'farmer' | 'visit' | 'report' | 'knowledge';
    entityId: string;
    createdBy?: string;
    isPublic?: boolean;
    expiresAt?: Date;
    permissions?: string[];
}

export interface ShareLink {
    token: string;
    url: string;
    expiresAt?: Date;
}

export interface ShareAccessResult {
    allowed: boolean;
    share?: any;
    error?: string;
}

class ShareService {
    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    private buildShareUrl(token: string): string {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        return `${baseUrl}/share/${token}`;
    }

    async createShare(options: CreateShareOptions): Promise<ShareLink> {
        const {
            entityType,
            entityId,
            createdBy,
            isPublic = false,
            expiresAt,
            permissions = ['view']
        } = options;

        // Validate entity exists
        await this.validateEntity(entityType, entityId);

        const token = this.generateToken();
        const prisma = getPrisma();

        const share = await prisma.share.create({
            data: {
                token,
                entityType,
                entityId,
                createdBy,
                isPublic,
                expiresAt,
                permissions,
            },
        });

        logger.info(`Share created for ${entityType}:${entityId} with token ${token}`);

        return {
            token,
            url: this.buildShareUrl(token),
            expiresAt: share.expiresAt || undefined,
        };
    }

    async validateShare(token: string, requiredPermission = 'view'): Promise<ShareAccessResult> {
        const prisma = getPrisma();
        const share = await prisma.share.findUnique({
            where: { token },
        });

        if (!share) {
            return { allowed: false, error: 'Share not found' };
        }

        // Check expiration
        if (share.expiresAt && new Date() > share.expiresAt) {
            return { allowed: false, error: 'Share has expired' };
        }

        // Check permissions
        if (!share.permissions.includes(requiredPermission)) {
            return { allowed: false, error: 'Insufficient permissions' };
        }

        // Record access
        await this.recordAccess(share.id);

        return { allowed: true, share };
    }

    async getShareData(token: string): Promise<Record<string, any> | null> {
        const validation = await this.validateShare(token);
        if (!validation.allowed) {
            throw new Error(validation.error);
        }

        const { entityType, entityId } = validation.share!;
        const prisma = getPrisma();

        // Fetch the actual entity data
        switch (entityType as string) {
            case 'farmer':
                return await prisma.farmer.findUnique({ where: { id: entityId } }) as any;
            case 'visit':
                return await prisma.visit.findUnique({ where: { id: entityId } }) as any;
            case 'report':
                return await prisma.report.findUnique({ where: { id: entityId } }) as any;
            case 'knowledge':
                return await prisma.knowledgeArticle.findUnique({ where: { id: entityId } }) as any;
            default:
                throw new Error('Unknown entity type');
        }
    }

    async shareViaEmail(token: string, recipientEmails: string[], message?: string): Promise<boolean> {
        const prisma = getPrisma();
        const share = await prisma.share.findUnique({ where: { token } });
        if (!share) {
            throw new Error('Share not found');
        }

        const shareUrl = this.buildShareUrl(token);
        const subject = `Shared ${share.entityType} from Ag Extension`;
        const html = `
      <p>You have been shared a ${share.entityType} from Ag Extension.</p>
      ${message ? `<p>${message}</p>` : ''}
      <p><a href="${shareUrl}">View ${share.entityType}</a></p>
      ${share.expiresAt ? `<p>This link expires on ${share.expiresAt.toDateString()}.</p>` : ''}
    `;

        const promises = recipientEmails.map(email =>
            emailService.sendEmail({
                to: email,
                subject,
                html,
            })
        );

        const results = await Promise.all(promises);
        return results.every(result => result);
    }

    async shareViaSMS(token: string, recipientPhones: string[], message?: string): Promise<boolean> {
        const prisma = getPrisma();
        const share = await prisma.share.findUnique({ where: { token } });
        if (!share) {
            throw new Error('Share not found');
        }

        const shareUrl = this.buildShareUrl(token);
        const smsMessage = `Shared ${share.entityType} from Ag Extension: ${shareUrl}${message ? ` - ${message}` : ''}`;

        const promises = recipientPhones.map(phone =>
            smsService.sendSMS({
                to: phone,
                message: smsMessage,
            })
        );

        const results = await Promise.all(promises);
        return results.every(result => result);
    }

    async getSharesByCreator(creatorId: string): Promise<any[]> {
        const prisma = getPrisma();
        return await prisma.share.findMany({
            where: { createdBy: creatorId },
            orderBy: { createdAt: 'desc' },
        }) as any[];
    }

    async deleteShare(token: string, creatorId: string): Promise<boolean> {
        const prisma = getPrisma();
        const share = await prisma.share.findUnique({ where: { token } });
        if (!share || share.createdBy !== creatorId) {
            return false;
        }

        await prisma.share.delete({ where: { token } });
        logger.info(`Share ${token} deleted by ${creatorId}`);
        return true;
    }

    private async validateEntity(entityType: string, entityId: string): Promise<void> {
        let exists = false;
        const prisma = getPrisma();

        switch (entityType) {
            case 'farmer':
                exists = !!(await prisma.farmer.findUnique({ where: { id: entityId } }));
                break;
            case 'visit':
                exists = !!(await prisma.visit.findUnique({ where: { id: entityId } }));
                break;
            case 'report':
                exists = !!(await prisma.report.findUnique({ where: { id: entityId } }));
                break;
            case 'knowledge':
                exists = !!(await prisma.knowledgeArticle.findUnique({ where: { id: entityId } }));
                break;
            default:
                throw new Error('Invalid entity type');
        }

        if (!exists) {
            throw new Error(`${entityType} with id ${entityId} not found`);
        }
    }

    private async recordAccess(shareId: string): Promise<void> {
        // Get client IP - in a real app, this would come from request
        const accessedBy = 'anonymous'; // For now
        const prisma = getPrisma();

        await prisma.shareAccess.create({
            data: {
                shareId,
                accessedBy,
            },
        });

        // Update access count
        await prisma.share.update({
            where: { id: shareId },
            data: {
                accessCount: { increment: 1 },
                lastAccessedAt: new Date(),
            },
        });
    }
}

export const shareService = new ShareService();