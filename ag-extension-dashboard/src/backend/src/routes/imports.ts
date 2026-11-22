/**
 * Library imports: one zip at a time, larger than an ordinary upload, so they have their
 * own path (and their own proxy limit in nginx.conf, `/api/imports/`).
 *   POST /imports/partner-recordings/:partnerId   audio + manifest.csv (administrator)
 *   POST /imports/diagnosis-photos                photos in crop/label folders (reviewers)
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { ArchiveError } from '@/services/archives/zipEntries';
import { PartnerError } from '@/services/partners/partners';
import { importRecordings } from '@/services/partners/recordingImport';
import { transcribeInBackground } from '@/services/partners/recordingTranscribe';
import { importLabelledPhotos } from '@/services/diagnosisTests/bulkImport';
import { TestSetError } from '@/services/diagnosisTests/testSet';

export const MAX_ARCHIVE_MB = Number(process.env.IMPORT_ARCHIVE_MAX_MB || 300);
const archive = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ARCHIVE_MB * 1024 * 1024, files: 1 } });
const router = Router();
type Principal = { userId: string; role: string; isDemo?: boolean };

/** Reads the one archive field, answering 400 when it is missing, too large or unreadable. */
function readArchive(req: Request, res: Response, next: NextFunction) {
    archive.single('archive')(req, res, (error: unknown) => {
        if (error) {
            const tooBig = (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
            return res.status(400).json({ success: false, error: tooBig ? `The archive is larger than ${MAX_ARCHIVE_MB} MB. Split it into smaller batches.` : 'The archive could not be read.' });
        }
        if (!req.file) return res.status(400).json({ success: false, error: 'Attach a zip archive as "archive".' });
        return next();
    });
}

function fail(res: Response, error: unknown, what: string) {
    if (error instanceof ArchiveError || error instanceof PartnerError || error instanceof TestSetError) {
        return res.status(error.status).json({ success: false, error: error.message });
    }
    logger.error(`Import of ${what} failed:`, error);
    return safeError(res, 500, `Could not import the ${what}`);
}

router.post('/partner-recordings/:partnerId', authorize(['admin']), validate({ params: z.object({ partnerId: z.guid() }) }), readArchive,
    async (req: Request, res: Response) => {
        try {
            const report = await importRecordings((req.user as Principal).userId, req.params.partnerId, req.file!.buffer);
            if (report.imported > 0) transcribeInBackground();
            return res.status(201).json({ success: true, data: report });
        } catch (error) { return fail(res, error, 'recordings'); }
    });

router.post('/diagnosis-photos', authorize(['admin', 'regional_manager']), readArchive, async (req: Request, res: Response) => {
    try {
        const country = typeof req.body?.country === 'string' && req.body.country.trim() ? req.body.country.trim().slice(0, 100) : null;
        return res.status(201).json({ success: true, data: await importLabelledPhotos(req.user as Principal, req.file!.buffer, country) });
    } catch (error) { return fail(res, error, 'photos'); }
});

export default router;
