/**
 * Photos, videos and voice notes that arrive on WhatsApp or Telegram. They are stored like
 * app uploads (type check, virus scan, object storage), tagged with the farmer, so the
 * farmer's officer and manager can open them in the thread or the visit report.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { saveUpload, UPLOAD_TYPES, type SupportedMimeType } from '@/services/uploadService';

export interface InboundMedia {
    buffer: Buffer;
    mimeType: string;
}

export type MediaKind = 'image' | 'video' | 'audio';

/** What a content type is, when the platform keeps that kind of file; null otherwise. */
export function mediaKind(mimeType: string | null | undefined): MediaKind | null {
    const mime = (mimeType ?? '').toLowerCase().split(';')[0].trim();
    if (!Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, mime)) return null;
    if (mime.startsWith('image/') && mime !== 'image/svg+xml') return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return null;
}

/** The thread text for a message that is only a file. */
export function mediaOnlyText(kind: MediaKind): string {
    return kind === 'image' ? 'Sent a photo.' : kind === 'video' ? 'Sent a video.' : 'Sent a voice note.';
}

/**
 * Whose storage the file counts against: the farmer's own account, else their officer.
 * Null when the farmer has neither, in which case the file is not kept.
 */
async function storageOwnerFor(farmerId: string): Promise<string | null> {
    const { rows } = await query<{ owner: string | null }>(
        'SELECT COALESCE(user_id, assigned_officer_id) AS owner FROM farmers WHERE id = $1',
        [farmerId],
    );
    return rows[0]?.owner ?? null;
}

/** Store each file for the farmer; returns the upload ids of those kept. */
export async function storeFarmerMedia(farmerId: string, media: InboundMedia[], ownerUserId?: string): Promise<string[]> {
    if (media.length === 0) return [];
    const owner = ownerUserId ?? (await storageOwnerFor(farmerId));
    if (!owner) {
        logger.warn(`Media from farmer ${farmerId} not kept: the farmer has no account and no officer`);
        return [];
    }
    const ids: string[] = [];
    for (const [index, item] of media.entries()) {
        const kind = mediaKind(item.mimeType);
        if (!kind) continue;
        const mimeType = item.mimeType.toLowerCase().split(';')[0].trim() as SupportedMimeType;
        try {
            const saved = await saveUpload({
                buffer: item.buffer,
                originalName: `${kind}-${index + 1}${UPLOAD_TYPES[mimeType]}`,
                mimeType,
                ownerUserId: owner,
                farmerId,
            });
            ids.push(saved.id);
        } catch (error) {
            logger.warn(`A ${kind} from farmer ${farmerId} was not kept:`, error);
        }
    }
    return ids;
}
