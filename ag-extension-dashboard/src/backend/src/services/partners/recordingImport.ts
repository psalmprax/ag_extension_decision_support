/**
 * Importing a partner's recordings in one go: a zip with the audio files and a
 * manifest.csv that says, for each file, its title, speaker, language, crops, regions,
 * topic and licence, and whether the speaker consented. Nothing is guessed: a row that
 * lacks the speaker, language, licence or consent is reported back, not imported.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { saveUpload } from '@/services/uploadService';
import { mimeTypeForName } from '@/services/uploadTypes';
import { ArchiveError, parseCsv, readZip, type ArchiveFile } from '@/services/archives/zipEntries';
import { PartnerError } from './partners';

export const MANIFEST_COLUMNS = ['file', 'title', 'speaker', 'language', 'crops', 'regions', 'topic', 'licence', 'licence_expires', 'consent'] as const;
const YES = /^(yes|y|true|1)$/i;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export interface ImportReport {
    imported: number;
    skipped: Array<{ file: string; reason: string }>;
}

interface ManifestRow {
    file: string;
    title: string;
    speaker: string;
    language: string;
    crops: string[];
    regions: string[];
    topic: string | null;
    licence: string;
    licenceExpiresAt: Date | null;
}

const list = (value: string | undefined) => (value ?? '').split(/[;|]/).map(item => item.trim()).filter(Boolean);

/** One manifest line checked, or the reason it cannot be imported. */
function checkRow(row: Record<string, string>): ManifestRow | { file: string; reason: string } {
    const file = row.file?.trim() ?? '';
    if (!file) return { file: '(no file name)', reason: 'The row has no file name' };
    if (!row.speaker?.trim()) return { file, reason: 'Who is speaking is missing' };
    const language = row.language?.trim().toLowerCase() ?? '';
    if (!LANGUAGE.test(language)) return { file, reason: 'Language must be a code such as sw, en or ny' };
    if (!row.licence?.trim()) return { file, reason: 'The licence is missing' };
    if (!YES.test(row.consent?.trim() ?? '')) return { file, reason: 'The speaker’s consent is not confirmed' };
    let licenceExpiresAt: Date | null = null;
    if (row.licence_expires?.trim()) {
        licenceExpiresAt = new Date(row.licence_expires.trim());
        if (Number.isNaN(licenceExpiresAt.getTime())) return { file, reason: 'licence_expires must be a date (YYYY-MM-DD)' };
    }
    return {
        file,
        title: (row.title?.trim() || file.replace(/\.[^.]+$/, '')).slice(0, 200),
        speaker: row.speaker.trim().slice(0, 160),
        language,
        crops: list(row.crops),
        regions: list(row.regions),
        topic: row.topic?.trim().slice(0, 80) || null,
        licence: row.licence.trim().slice(0, 80),
        licenceExpiresAt,
    };
}

function manifestOf(files: ArchiveFile[]): Array<Record<string, string>> {
    const manifest = files.find(file => file.path.split('/').pop()?.toLowerCase() === 'manifest.csv');
    if (!manifest) throw new ArchiveError(`The archive needs a manifest.csv with the columns: ${MANIFEST_COLUMNS.join(', ')}`);
    return parseCsv(manifest.data.toString('utf8'));
}

export async function importRecordings(adminId: string, partnerId: string, archive: Buffer): Promise<ImportReport> {
    const { rows: partners } = await query('SELECT 1 FROM content_partners WHERE id = $1', [partnerId]);
    if (!partners[0]) throw new PartnerError('Partner not found', 404);
    const files = readZip(archive);
    const byName = new Map(files.map(file => [file.path.split('/').pop()?.toLowerCase() ?? file.path, file]));
    const report: ImportReport = { imported: 0, skipped: [] };

    for (const raw of manifestOf(files)) {
        const row = checkRow(raw);
        if ('reason' in row) { report.skipped.push(row); continue; }
        const audio = byName.get(row.file.toLowerCase());
        const mimeType = audio ? mimeTypeForName(audio.path, 'audio') : null;
        if (!audio) { report.skipped.push({ file: row.file, reason: 'The file is not in the archive' }); continue; }
        if (!mimeType?.startsWith('audio/')) { report.skipped.push({ file: row.file, reason: 'Not an audio file (mp3, m4a, ogg, wav, aac or webm)' }); continue; }
        try {
            const upload = await saveUpload({ buffer: audio.data, originalName: row.file, mimeType, ownerUserId: adminId, quotaExempt: true });
            await query(
                `INSERT INTO partner_recordings
                   (partner_id, upload_id, title, speaker, language, crops, regions, topic, licence, licence_expires_at, consent_confirmed, imported_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)`,
                [partnerId, upload.id, row.title, row.speaker, row.language, row.crops, row.regions, row.topic, row.licence, row.licenceExpiresAt, adminId],
            );
            report.imported += 1;
        } catch (error) {
            logger.warn(`Partner recording ${row.file} was not imported:`, error);
            report.skipped.push({ file: row.file, reason: (error as Error).message || 'Could not be stored' });
        }
    }
    return report;
}
