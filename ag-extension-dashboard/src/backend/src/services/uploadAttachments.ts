import { query } from '@/services/databaseService';

/** A photo linked to a chat message, visit or progress entry, as clients receive it. */
export interface AttachmentDto {
    id: string;
    url: string;
    name: string;
    mimeType: string;
}

/** Photos per chat message, visit report or progress entry. */
export const MAX_ATTACHMENTS = 4;

/** Link tables and the column naming their parent row (never taken from user input). */
const LINK_TABLES = {
    chat: { table: 'chat_message_attachments', parent: 'message_id' },
    visit: { table: 'visit_attachments', parent: 'visit_id' },
    progress: { table: 'farmer_progress_attachments', parent: 'entry_id' },
} as const;

export type AttachmentLink = keyof typeof LINK_TABLES;

export class AttachmentError extends Error {
    readonly statusCode = 400;
}

/** The upload ids in a request body: a de-duplicated list of strings, or an error. */
export function parseAttachmentIds(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) {
        throw new AttachmentError('attachmentIds must be a list of upload ids');
    }
    const ids = Array.from(new Set(value as string[]));
    if (ids.length > MAX_ATTACHMENTS) {
        throw new AttachmentError(`At most ${MAX_ATTACHMENTS} photos can be attached`);
    }
    return ids;
}

/**
 * Throws unless every upload is an active image the sender uploaded for this
 * farmer. Uploads are tagged with a farmer when they are made (the upload
 * route checks the uploader may act for that farmer), and that tag is what
 * lets the farmer's officer, manager and the farmer read the photo back.
 */
export async function assertAttachableImages(ids: string[], ownerUserId: string, farmerId: string): Promise<void> {
    if (ids.length === 0) return;
    const { rows } = await query<{ id: string }>(
        `SELECT id FROM upload_records
          WHERE id::text = ANY($1::text[])
            AND owner_user_id = $2
            AND farmer_id = $3
            AND status = 'active'
            AND mime_type LIKE 'image/%'`,
        [ids, ownerUserId, farmerId]
    );
    if (rows.length !== ids.length) {
        throw new AttachmentError('Photos must be images you uploaded for this farmer');
    }
}

export async function linkAttachments(link: AttachmentLink, parentId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { table, parent } = LINK_TABLES[link];
    await query(
        `INSERT INTO ${table} (${parent}, upload_id)
         SELECT $1::uuid, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [parentId, ids]
    );
}

/** Attachments for each parent row, in upload order; parents without any are absent. */
export async function listAttachments(link: AttachmentLink, parentIds: string[]): Promise<Map<string, AttachmentDto[]>> {
    const byParent = new Map<string, AttachmentDto[]>();
    if (parentIds.length === 0) return byParent;
    const { table, parent } = LINK_TABLES[link];
    const { rows } = await query<{ parent_id: string; id: string; storage_key: string; original_name: string; mime_type: string }>(
        `SELECT a.${parent} AS parent_id, u.id, u.storage_key, u.original_name, u.mime_type
           FROM ${table} a
           JOIN upload_records u ON u.id = a.upload_id
          WHERE a.${parent}::text = ANY($1::text[]) AND u.status = 'active'
          ORDER BY a.created_at ASC, u.created_at ASC`,
        [parentIds]
    );
    for (const row of rows) {
        const list = byParent.get(row.parent_id) ?? [];
        list.push({
            id: row.id,
            url: `/api/v1/upload/file/${encodeURIComponent(row.storage_key)}`,
            name: row.original_name,
            mimeType: row.mime_type,
        });
        byParent.set(row.parent_id, list);
    }
    return byParent;
}
