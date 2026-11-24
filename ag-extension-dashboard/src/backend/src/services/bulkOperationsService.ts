import { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaService';
import { logger } from '@/utils/logger';
import { query } from './databaseService';
import crypto from 'crypto';
import { demoWhere } from '@/services/demoScope';
import { farmerRecordFilter } from './demoRecordScope';
import { toE164 } from '@/services/country/phone';
import { farmerCountryFor } from '@/services/country/countryContext';

type Tx = Prisma.TransactionClient;
type BatchStats = { current: number; processed: number; failed: number; errors: string[] };

/** Narrowing an export: one region, or a name or village containing the search text. */
export interface FarmerExportFilters {
    region?: string;
    search?: string;
}

/** One CSV row as farmer columns; country is resolved before the row is saved. */
type ImportedFarmer = {
    firstName?: string;
    lastName?: string;
    phone?: string;
    region?: string;
    district?: string;
    village?: string;
    crops?: string[];
    farmSizeHectares?: number | null;
    vitalScore?: number | null;
    locationLat?: number | null;
    locationLng?: number | null;
    languagePreference?: string;
    country?: string;
};

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
    updates: Record<string, unknown>;
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

class BulkOperationsService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = getPrisma();
    }

    private generateOperationId(): string {
        return `bulk_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    }

    private async executeBulkDelete(
        entityType: string,
        ids: string[],
        userId: string,
        userRole: string,
        deleteItem: (id: string, tx: Tx) => Promise<void>
    ): Promise<BulkOperationResult> {
        const operationId = this.generateOperationId();
        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        logger.info(`Starting bulk ${entityType} deletion: ${ids.length} items`, { operationId, userId });

        // One transaction per item. A shared transaction with per-item catches
        // is wrong on Postgres: the first failed statement aborts it, the rest of
        // the batch then fails, and COMMIT silently rolls back the items already
        // counted as processed, so the reported counts were not what happened.
        for (const id of ids) {
            try {
                await this.prisma.$transaction(async (tx) => deleteItem(id, tx));
                processed++;
            } catch (error) {
                failed++;
                errors.push(`Failed to delete ${entityType} ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
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

    private notifyProgress(onProgress: ((update: ProgressUpdate) => void) | undefined, operationId: string, current: number, total: number) {
        if (onProgress) {
            onProgress({ operationId, progress: (current / total) * 100, total, current, message: `Deleting articles: ${current}/${total}`, status: 'running' });
        }
    }

    /** Each delete stands alone, so one that fails (a record still pointing at the article) cannot undo the others. */
    private async processKnowledgeArticleBatch(batch: string[], onProgress: ((update: ProgressUpdate) => void) | undefined, operationId: string, total: number, stats: BatchStats) {
        for (const articleId of batch) {
            try {
                await this.prisma.knowledgeArticle.delete({ where: { id: articleId } });
                stats.processed++;
                stats.current++;
                this.notifyProgress(onProgress, operationId, stats.current, total);
            } catch (error) {
                stats.failed++;
                stats.errors.push(`Failed to delete article ${articleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                stats.current++;
            }
        }
    }

    async bulkDeleteKnowledgeArticles(request: BulkDeleteRequest, userId: string, userRole: string, onProgress?: (update: ProgressUpdate) => void): Promise<BulkOperationResult> {
        if (userRole !== 'admin') throw new Error('Only administrators can perform bulk knowledge article operations');

        const operationId = this.generateOperationId();
        const total = request.ids.length;
        const stats = { current: 0, processed: 0, failed: 0, errors: [] as string[] };

        logger.info(`Starting bulk knowledge article deletion: ${total} articles`, { operationId, userId });

        for (let i = 0; i < request.ids.length; i += 10) {
            const batch = request.ids.slice(i, i + 10);
            await this.processKnowledgeArticleBatch(batch, onProgress, operationId, total, stats);
        }

        const result = { success: stats.failed === 0, processed: stats.processed, failed: stats.failed, errors: stats.errors, operationId };
        if (onProgress) onProgress({ operationId, progress: 100, total, current: stats.current, message: result.success ? 'Deletion completed successfully' : 'Deletion completed with errors', status: result.success ? 'completed' : 'failed' });
        return result;
    }

    private async assertFarmerUpdateAllowed(prev: { assignedOfficerId: string | null; userId: string | null; region: string | null }, userId: string, userRole: string, tx: Tx): Promise<void> {
        if (userRole === 'admin') return;
        if (userRole === 'extension_officer') {
            if (prev.assignedOfficerId !== userId && prev.userId !== userId) throw new Error('Access denied');
            return;
        }
        if (userRole === 'farmer') {
            if (prev.userId !== userId) throw new Error('Access denied');
            return;
        }
        const manager = await tx.user.findUnique({ where: { id: userId }, select: { region: true } });
        if (manager?.region !== prev.region) throw new Error('Access denied');
    }

    private async updateFarmerItem(farmerId: string, updates: Record<string, unknown>, userId: string, userRole: string, tx: Tx): Promise<void> {
        const prev = await tx.farmer.findUnique({ where: { id: farmerId }, select: { assignedOfficerId: true, userId: true, region: true, tenantId: true } });
        if (!prev) throw new Error('Not found');
        await this.assertFarmerUpdateAllowed(prev, userId, userRole, tx);
        const nextOfficerId = updates.assignedOfficerId as string | null | undefined;
        // Record assignment history whenever the officer assignment changes.
        if (nextOfficerId !== undefined && nextOfficerId !== prev.assignedOfficerId) {
            await tx.farmerAssignmentHistory.create({
                data: {
                    farmerId,
                    officerId: nextOfficerId,
                    reassignedBy: userId,
                    reason: `bulk reassignment from ${prev.assignedOfficerId ?? 'none'} to ${nextOfficerId ?? 'none'}`,
                },
            });
        }
        // Preserve tenant on the farmer when updates don't touch it.
        const merged = { tenantId: prev.tenantId, ...updates };
        await tx.farmer.update({ where: { id: farmerId }, data: { ...merged as object, updatedAt: new Date() } });
    }

    async bulkUpdateFarmers(request: BulkUpdateRequest, userId: string, userRole: string): Promise<BulkOperationResult> {
        return this.executeBulkDelete('farmer', request.ids, userId, userRole, (farmerId, tx) =>
            this.updateFarmerItem(farmerId, request.updates as Record<string, unknown>, userId, userRole, tx)
        );
    }

    private async buildFarmerExportFilters(filters: FarmerExportFilters, userId: string, userRole: string): Promise<Prisma.FarmerWhereInput> {
        // Exports are for real accounts only: demo farmers are never exported.
        const where: Prisma.FarmerWhereInput = { ...demoWhere(), AND: [farmerRecordFilter(false)] };

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

        if (filters.region) where.region = filters.region;
        if (filters.search) {
            where.OR = [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { village: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }

    /**
     * Export data to CSV format
     */
    async exportFarmersToCSV(
        filters: FarmerExportFilters,
        userId: string,
        userRole: string
    ): Promise<string> {
        const where = await this.buildFarmerExportFilters(filters, userId, userRole);

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
            row.map(field => {
                const str = field.toString();
                const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
                return `"${sanitized.replace(/"/g, '""')}"`;
            }).join(',')
        ).join('\n');
    }

    private mapHeaderToField(header: string, value: string, farmerData: ImportedFarmer) {
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
            case 'country':
                farmerData.country = value;
                break;
        }
    }

    private async processCSVRow(row: string, headers: string[], tx: Tx, userRole: string, userId: string): Promise<ImportedFarmer> {
        const values = this.parseCSVRow(row);
        if (values.length !== headers.length) {
            throw new Error(`Column count mismatch`);
        }

        const farmerData: ImportedFarmer = {};
        headers.forEach((header, index) => {
            const value = values[index]?.replace(/"/g, '').trim();
            this.mapHeaderToField(header, value, farmerData);
        });

        // Validate required fields
        const { firstName, lastName } = farmerData;
        if (!firstName || !lastName) {
            throw new Error(`Missing required fields (firstName, lastName)`);
        }

        // Apply regional restrictions for regional managers
        if (userRole === 'regional_manager') {
            const manager = await tx.user.findUnique({
                where: { id: userId },
                select: { region: true }
            });
            if (manager?.region && farmerData.region !== manager.region) {
                throw new Error(`Cannot import farmers from different region`);
            }
        }

        // Country: the row's own, else the importer's. Phones are stored in E.164 for that country.
        const country = await farmerCountryFor(farmerData.country, userId);
        farmerData.country = country;
        if (farmerData.phone) {
            const phone = toE164(String(farmerData.phone), country);
            if (!phone) throw new Error(`Phone number ${farmerData.phone} is not valid for ${country}`);
            farmerData.phone = phone;
        }

        await tx.farmer.create({ data: { ...farmerData, firstName, lastName, country, isActive: true } });

        return farmerData;
    }

    /**
     * One transaction per row, as in executeBulkDelete: with a shared one, the first database
     * error (a duplicate phone, say) aborted it on Postgres, and the rows counted as imported
     * before it were rolled back on commit.
     */
    private async processImportBatch(batch: string[], startIndex: number, headers: string[], userRole: string, userId: string, result: { imported: number; skipped: number; errors: string[] }) {
        for (let j = 0; j < batch.length; j++) {
            try {
                await this.prisma.$transaction(tx => this.processCSVRow(batch[j], headers, tx, userRole, userId));
                result.imported++;
            } catch (error) {
                result.skipped++;
                result.errors.push(`Row ${startIndex + j + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
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
        const result = { imported: 0, skipped: 0, errors: [] as string[] };

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
                await this.processImportBatch(batch, i, headers, userRole, userId, result);
            }

            return result;

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