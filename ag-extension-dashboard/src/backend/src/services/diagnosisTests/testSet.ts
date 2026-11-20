/**
 * The labelled photos photo diagnosis is tested on. An agronomist uploads photos with the
 * right answer, and officers add photos from farmers' threads once they have confirmed the
 * problem in the field. Only images can be added, and only ones the person may see.
 */
import { query } from '@/services/databaseService';
import { canSeeFarmer, type ScopePrincipal } from '@/services/access/farmerScope';
import { normaliseLabel } from './matching';

export class TestSetError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

export interface TestImageInput {
    uploadId: string;
    crop: string;
    label: string;
    country?: string | null;
}

/** May this person label this photo? Their own upload, or a photo of a farmer they serve. */
async function assertMayLabel(principal: ScopePrincipal, uploadId: string): Promise<void> {
    const { rows } = await query<{ owner_user_id: string; farmer_id: string | null; mime_type: string }>(
        `SELECT owner_user_id, farmer_id, mime_type FROM upload_records WHERE id = $1 AND status = 'active'`,
        [uploadId],
    );
    const upload = rows[0];
    if (!upload) throw new TestSetError('Photo not found', 404);
    if (!upload.mime_type.startsWith('image/') || upload.mime_type === 'image/svg+xml') throw new TestSetError('Only photos can be labelled');
    if (upload.owner_user_id === principal.userId || principal.role === 'admin') return;
    if (upload.farmer_id && (await canSeeFarmer(principal, upload.farmer_id))) return;
    throw new TestSetError('Photo not found', 404);
}

/** Add (or relabel) a photo. Officers' labels are field confirmations; managers' and admins' are agronomist labels. */
export async function addTestImage(principal: ScopePrincipal, input: TestImageInput): Promise<{ id: string }> {
    const crop = normaliseLabel(input.crop);
    const label = normaliseLabel(input.label);
    if (!crop || !label) throw new TestSetError('Give the crop and what the photo shows');
    await assertMayLabel(principal, input.uploadId);
    const source = principal.role === 'extension_officer' ? 'officer_confirmation' : 'agronomist';
    const { rows } = await query<{ id: string }>(
        `INSERT INTO diagnosis_test_images (upload_id, crop, label, source, country, labelled_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (upload_id) DO UPDATE SET crop = EXCLUDED.crop, label = EXCLUDED.label,
             source = EXCLUDED.source, labelled_by = EXCLUDED.labelled_by
         RETURNING id`,
        [input.uploadId, crop, label, source, input.country ?? null, principal.userId],
    );
    return { id: rows[0].id };
}

export async function removeTestImage(id: string): Promise<boolean> {
    const { rowCount } = await query('DELETE FROM diagnosis_test_images WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
}

export interface ClassRow {
    crop: string;
    label: string;
    photos: number;
    fieldConfirmed: number;
    /** From the latest finished run; null before any run covered the class. */
    tested: number | null;
    correct: number | null;
}

/** Each crop and label in the test set, with its latest result. */
export async function listClasses(): Promise<ClassRow[]> {
    const { rows } = await query<{ crop: string; label: string; photos: string; field_confirmed: string; samples: number | null; correct: number | null }>(
        `SELECT t.crop, t.label, COUNT(*) AS photos,
                COUNT(*) FILTER (WHERE t.source = 'officer_confirmation') AS field_confirmed,
                s.samples, s.correct
           FROM diagnosis_test_images t
           LEFT JOIN diagnosis_class_status s ON s.crop = t.crop AND s.label = t.label
          GROUP BY t.crop, t.label, s.samples, s.correct
          ORDER BY t.crop, t.label`,
    );
    return rows.map(row => ({
        crop: row.crop, label: row.label, photos: Number(row.photos), fieldConfirmed: Number(row.field_confirmed),
        tested: row.samples, correct: row.correct,
    }));
}
