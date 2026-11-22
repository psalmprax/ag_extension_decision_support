/**
 * Loading a labelled photo set in one go: a zip whose folders name the crop and what the
 * photo shows, `maize/fall_armyworm/IMG_001.jpg`, as agronomists usually sort them. The
 * labels come from the folders the agronomist made; nothing is inferred from the photos.
 */
import { logger } from '@/utils/logger';
import { saveUpload } from '@/services/uploadService';
import { mimeTypeForName } from '@/services/uploadTypes';
import { readZip } from '@/services/archives/zipEntries';
import type { ScopePrincipal } from '@/services/access/farmerScope';
import { addTestImage } from './testSet';

export interface PhotoImportReport {
    imported: number;
    skipped: Array<{ file: string; reason: string }>;
}

export async function importLabelledPhotos(principal: ScopePrincipal, archive: Buffer, country?: string | null): Promise<PhotoImportReport> {
    const report: PhotoImportReport = { imported: 0, skipped: [] };
    for (const file of readZip(archive)) {
        const parts = file.path.split('/').filter(Boolean);
        // The crop and label are the last two folders, so a wrapping top folder is fine.
        if (parts.length < 3) {
            report.skipped.push({ file: file.path, reason: 'Put each photo in a crop/label folder, e.g. maize/fall_armyworm/photo.jpg' });
            continue;
        }
        const [crop, label] = parts.slice(-3, -1);
        const mimeType = mimeTypeForName(file.path, 'image');
        if (!mimeType?.startsWith('image/') || mimeType === 'image/svg+xml') {
            report.skipped.push({ file: file.path, reason: 'Not a photo (jpg, png or webp)' });
            continue;
        }
        try {
            const upload = await saveUpload({ buffer: file.data, originalName: parts[parts.length - 1], mimeType, ownerUserId: principal.userId });
            await addTestImage(principal, { uploadId: upload.id, crop, label, country });
            report.imported += 1;
        } catch (error) {
            logger.warn(`Labelled photo ${file.path} was not imported:`, error);
            report.skipped.push({ file: file.path, reason: (error as Error).message || 'Could not be stored' });
        }
    }
    return report;
}
