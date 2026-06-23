/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaService';
import { logger } from '@/utils/logger';
import { query } from './databaseService';

export interface BulkOperationResult {
    success: boolean;
    processed: number;
    failed: number;
    errors: string[];
    operationId: string;
}

export interface BulkDeleteRequest {
    ids: string[];
    reason?: string;
}

export interface BulkUpdateRequest {
    ids: string[];
    updates: Record<string, any>;
}

export interface BulkImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

export interface ProgressUpdate {
    operationId: string;
    progress: number;
    total: number;
    current: number;
    message: string;
    status: 'running' | 'completed' | 'failed';
}

export class BulkOperationsService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = getPrisma();
    }

    private generateOperationId(): string {
        return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async executeBulkDelete(
        entityType: string,
        ids: string[],
        userId: string,
        userRole: string,
        deleteItem: (id: string, tx: any) => Promise<void>,
        batchSize: number = 10
    ): Promise<BulkOperationResult> {
        const operationId = this.generateOperationId();
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        logger.info(`Starting bulk ${entityType} deletion: ${ids.length} items`, { operationId, userId });

        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await this.prisma.$transaction(async (tx) => {
                for (const id of batch) {
                    try {
                        await deleteItem(id, tx);
                        processed++;
                    } catch (error) {
                        failed++;
                        errors.push(`Failed to delete ${entityType} ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            });
        }

        const result = { success: failed === 0, processed, failed, errors, operationId };
        logger.info(`Bulk ${entityType} deletion completed`, { operationId, processed, failed });
        return result;
    }

    async bulkDeleteFarmers(request: BulkDeleteRequest, userId: string, userRole: string): Promise<BulkOperationResult> {
        return this.executeBulkDelete('farmer', request.ids, userId, userRole, async (farmerId, tx) => {
            if (userRole !== 'admin') {
                const farmer = await tx.farmer.findUnique({ where: { id: farmerId }, select: { assignedOfficerId: true, userId: true, region: true } });
                if (!farmer) throw new Error('Not found');
                if (userRole === 'extension_officer' && farmer.assignedOfficerId !== userId && farmer.userId !== userId) throw new Error('Access denied');
                if (userRole === 'farmer' && farmer.userId !== userId) throw new Error('Access denied');
                if (userRole === 'regional_manager') {
                    const manager = await tx.user.findUnique({ where: { id: userId }, select: { region: true } });
                    if (manager?.region !== farmer.region) throw new Error('Access denied');
                }
            }
            await tx.farmer.delete({ where: { id: farmerId } });
        });
    }

    async bulkDeleteVisits(request: BulkDeleteRequest, userId: string, userRole: string): Promise<BulkOperationResult> {
        const operationId = this.generateOperationId();
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        logger.info(`Starting bulk visit deletion: ${request.ids.length} visits`, { operationId, userId });

        for (let i = 0; i < request.ids.length; i += 20) {
            const batch = request.ids.slice(i, i + 20);
            for (const visitId of batch) {
                try {
                    const permissionCheck = await query(
                        'SELECT v.id FROM visits v LEFT JOIN farmers f ON f.id = v.farmer_id WHERE v.id = $1 AND (v.officer_id = $2 OR f.assigned_officer_id = $2 OR $3 IN ($4, $5))',
                        [visitId, userId, userRole, 'admin', 'regional_manager']
                    );
                    if (permissionCheck.rows.length === 0) { failed++; errors.push(`Access denied for visit ${visitId}`); continue; }
                    await query('DELETE FROM visits WHERE id = $1', [visitId]);
                    processed++;
                } catch (error) {
                    failed++;
                    errors.push(`Failed to delete visit ${visitId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }

        const result = { success: failed === 0, processed, failed, errors, operationId };
        logger.info(`Bulk visit deletion completed`, { operationId, processed, failed });
        return result;
    }

    async bulkDeleteReports(request: BulkDeleteRequest, userId: string, userRole: string): Promise<BulkOperationResult> {
        return this.executeBulkDelete('report', request.ids, userId, userRole, async (reportId, tx) => {
            if (userRole !== 'admin') {
                const report = await tx.report.findUnique({ where: { id: reportId }, select: { generatedBy: true } });
                if (!report || report.generatedBy !== userId) throw new Error('Access denied');
            }
            await tx.report.delete({ where: { id: reportId } });
        });
    }

    async bulkDeleteKnowledgeArticles(request: BulkDeleteRequest, userId: string, userRole: string, onProgress?: (update: ProgressUpdate) => void): Promise<BulkOperationResult> {
        if (userRole !== 'admin') throw new Error('Only administrators can perform bulk knowledge article operations');

        const operationId = this.generateOperationId();
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];
        const total = request.ids.length;
        let current = 0;

        logger.info(`Starting bulk knowledge article deletion: ${total} articles`, { operationId, userId });

        for (let i = 0; i < request.ids.length; i += 10) {
            const batch = request.ids.slice(i, i + 10);
            await this.prisma.$transaction(async (tx) => {
                for (const articleId of batch) {
                    try {
                        await tx.knowledgeArticle.delete({ where: { id: articleId } });
                        processed++;
                        current++;
                        if (onProgress) onProgress({ operationId, progress: (current / total) * 100, total, current, message: `Deleting articles: ${current}/${total}`, status: 'running' });
                    } catch (error) {
                        failed++;
                        errors.push(`Failed to delete article ${articleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        current++;
                    }
                }
            });
        }

        const result = { success: failed === 0, processed, failed, errors, operationId };
        if (onProgress) onProgress({ operationId, progress: 100, total, current, message: result.success ? 'Deletion completed successfully' : 'Deletion completed with errors', status: result.success ? 'completed' : 'failed' });
        return result;
    }

    async bulkUpdateFarmers(request: BulkUpdateRequest, userId: string, userRole: string): Promise<BulkOperationResult> {
        return this.executeBulkDelete('farmer', request.ids, userId, userRole, async (farmerId, tx) => {
            if (userRole !== 'admin') {
                const farmer = await tx.farmer.findUnique({ where: { id: farmerId }, select: { assignedOfficerId: true, userId: true, region: true } });
                if (!farmer) throw new Error('Not found');
                if (userRole === 'extension_officer' && farmer.assignedOfficerId !== userId && farmer.userId !== userId) throw new Error('Access denied');
                if (userRole === 'farmer' && farmer.userId !== userId) throw new Error('Access denied');
                if (userRole === 'regional_manager') {
                    const manager = await tx.user.findUnique({ where: { id: userId }, select: { region: true } });
                    if (manager?.region !== farmer.region) throw new Error('Access denied');
                }
            }
            await tx.farmer.update({ where: { id: farmerId }, data: { ...request.updates, updatedAt: new Date() } });
        });
    }

    /**
     * Export data to CSV format
     */
    async exportFarmersToCSV(
        filters: any,
        userId: string,
        userRole: string
    ): Promise<string> {
        const where: any = {};

        // Apply role-based filtering
        if (userRole === 'extension_officer') {
            where.assignedOfficerId = userId;
        } else if (userRole === 'regional_manager') {
            const manager = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { region: true }
            });
            if (manager?.region) {
                where.region = manager.region;
            }
        } else if (userRole === 'farmer') {
            where.userId = userId;
        }

        // Apply filters
        if (filters.region) where.region = filters.region;
        if (filters.search) {
            where.OR = [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { village: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const farmers = await this.prisma.farmer.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                region: true,
                village: true,
                district: true,
                crops: true,
                farmSizeHectares: true,
                vitalScore: true,
                locationLat: true,
                locationLng: true,
                languagePreference: true,
                createdAt: true
            }
        });

        // Generate CSV
        const headers = [
            'ID', 'First Name', 'Last Name', 'Phone', 'Region', 'District', 'Village',
            'Crops', 'Farm Size (Hectares)', 'Vital Score', 'Latitude', 'Longitude',
            'Language Preference', 'Created At'
        ];

        const rows = farmers.map(farmer => [
            farmer.id,
            farmer.firstName,
            farmer.lastName,
            farmer.phone || '',
            farmer.region || '',
            farmer.district || '',
            farmer.village || '',
            farmer.crops.join('; '),
            farmer.farmSizeHectares?.toString() || '',
            farmer.vitalScore?.toString() || '',
            farmer.locationLat?.toString() || '',
            farmer.locationLng?.toString() || '',
            farmer.languagePreference || 'en',
            farmer.createdAt?.toISOString() || ''
        ]);

        return [headers, ...rows].map(row =>
            row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    /**
     * Import farmers from CSV
     */
    async importFarmersFromCSV(
        csvData: string,
        userId: string,
        userRole: string
    ): Promise<BulkImportResult> {
        const operationId = this.generateOperationId();
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        try {
            // Only admins and regional managers can import
            if (!['admin', 'regional_manager'].includes(userRole)) {
                throw new Error('Insufficient permissions to import farmers');
            }

            const lines = csvData.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('CSV must contain headers and at least one data row');
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const dataRows = lines.slice(1);

            // Process in batches
            const batchSize = 10;
            for (let i = 0; i < dataRows.length; i += batchSize) {
                const batch = dataRows.slice(i, i + batchSize);

                await this.prisma.$transaction(async (tx) => {
                    for (const row of batch) {
                        try {
                            const values = this.parseCSVRow(row);
                            if (values.length !== headers.length) {
                                skipped++;
                                errors.push(`Row ${i + 2}: Column count mismatch`);
                                continue;
                            }

                            const farmerData: any = {};
                            headers.forEach((header, index) => {
                                const value = values[index]?.replace(/"/g, '').trim();
                                switch (header.toLowerCase()) {
                                    case 'first name':
                                    case 'firstname':
                                        farmerData.firstName = value;
                                        break;
                                    case 'last name':
                                    case 'lastname':
                                        farmerData.lastName = value;
                                        break;
                                    case 'phone':
                                        farmerData.phone = value;
                                        break;
                                    case 'region':
                                        farmerData.region = value;
                                        break;
                                    case 'district':
                                        farmerData.district = value;
                                        break;
                                    case 'village':
                                        farmerData.village = value;
                                        break;
                                    case 'crops':
                                        farmerData.crops = value ? value.split(';').map((c: string) => c.trim()) : [];
                                        break;
                                    case 'farm size (hectares)':
                                        farmerData.farmSizeHectares = value ? parseFloat(value) : null;
                                        break;
                                    case 'vital score':
                                        farmerData.vitalScore = value ? parseFloat(value) : null;
                                        break;
                                    case 'latitude':
                                        farmerData.locationLat = value ? parseFloat(value) : null;
                                        break;
                                    case 'longitude':
                                        farmerData.locationLng = value ? parseFloat(value) : null;
                                        break;
                                    case 'language preference':
                                        farmerData.languagePreference = value || 'en';
                                        break;
                                }
                            });

                            // Validate required fields
                            if (!farmerData.firstName || !farmerData.lastName) {
                                skipped++;
                                errors.push(`Row ${i + 2}: Missing required fields (firstName, lastName)`);
                                continue;
                            }

                            // Apply regional restrictions for regional managers
                            if (userRole === 'regional_manager') {
                                const manager = await tx.user.findUnique({
                                    where: { id: userId },
                                    select: { region: true }
                                });
                                if (manager?.region && farmerData.region !== manager.region) {
                                    skipped++;
                                    errors.push(`Row ${i + 2}: Cannot import farmers from different region`);
                                    continue;
                                }
                            }

                            await tx.farmer.create({
                                data: {
                                    ...farmerData,
                                    country: 'Kenya',
                                    isActive: true
                                }
                            });

                            imported++;
                        } catch (error) {
                            skipped++;
                            errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                });
            }

            return { imported, skipped, errors };

        } catch (error) {
            logger.error(`Farmer import failed`, { operationId, error });
            throw error;
        }
    }

    /**
     * Parse CSV row handling quoted values
     */
    private parseCSVRow(row: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
                if (inQuotes && row[i + 1] === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }
}

export const bulkOperationsService = new BulkOperationsService();