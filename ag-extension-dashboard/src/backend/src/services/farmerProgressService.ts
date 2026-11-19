import { query } from '@/services/databaseService';
import { type AttachmentDto, linkAttachments, listAttachments } from '@/services/uploadAttachments';

/** What an officer can record about a farmer's progress. */
export const PROGRESS_KINDS = ['success', 'failure', 'field_event', 'action', 'observation'] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];

export interface ProgressEntryInput {
    farmerId: string;
    officerId: string;
    tenantId: string | null;
    visitId: string | null;
    kind: ProgressKind;
    title: string;
    details: string | null;
    crop: string | null;
    occurredOn: string;
    attachmentIds: string[];
}

export interface ProgressEntryDto {
    id: string;
    farmerId: string;
    officerId: string | null;
    officerName: string | null;
    visitId: string | null;
    kind: ProgressKind;
    title: string;
    details: string | null;
    crop: string | null;
    /** YYYY-MM-DD */
    occurredOn: string;
    createdAt: string | null;
    attachments: AttachmentDto[];
}

interface ProgressRow {
    id: string;
    farmer_id: string;
    officer_id: string | null;
    officer_name: string | null;
    visit_id: string | null;
    kind: ProgressKind;
    title: string;
    details: string | null;
    crop: string | null;
    occurred_on: string;
    created_at: Date | string | null;
}

const SELECT_ENTRIES = `
    SELECT e.id, e.farmer_id, e.officer_id, e.visit_id, e.kind, e.title, e.details, e.crop,
           to_char(e.occurred_on, 'YYYY-MM-DD') AS occurred_on, e.created_at,
           NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS officer_name
      FROM farmer_progress_entries e
      LEFT JOIN users u ON u.id = e.officer_id`;

function toDto(row: ProgressRow, attachments: Map<string, AttachmentDto[]>): ProgressEntryDto {
    return {
        id: row.id,
        farmerId: row.farmer_id,
        officerId: row.officer_id,
        officerName: row.officer_name,
        visitId: row.visit_id,
        kind: row.kind,
        title: row.title,
        details: row.details,
        crop: row.crop,
        occurredOn: row.occurred_on,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        attachments: attachments.get(row.id) ?? [],
    };
}

/** True when the visit exists and is one of this farmer's visits. */
export async function visitBelongsToFarmer(visitId: string, farmerId: string): Promise<boolean> {
    const { rows } = await query<{ id: string }>('SELECT id FROM visits WHERE id = $1 AND farmer_id = $2', [visitId, farmerId]);
    return rows.length > 0;
}

/** A farmer's progress log, most recent first. */
export async function listProgressEntries(farmerId: string): Promise<ProgressEntryDto[]> {
    const { rows } = await query<ProgressRow>(
        `${SELECT_ENTRIES} WHERE e.farmer_id = $1 ORDER BY e.occurred_on DESC, e.created_at DESC`,
        [farmerId]
    );
    const attachments = await listAttachments('progress', rows.map(row => row.id));
    return rows.map(row => toDto(row, attachments));
}

export async function createProgressEntry(input: ProgressEntryInput): Promise<ProgressEntryDto> {
    const { rows } = await query<{ id: string }>(
        `INSERT INTO farmer_progress_entries
            (farmer_id, officer_id, tenant_id, visit_id, kind, title, details, crop, occurred_on)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date)
         RETURNING id`,
        [input.farmerId, input.officerId, input.tenantId, input.visitId, input.kind, input.title,
            input.details, input.crop, input.occurredOn]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Progress entry was not stored');
    await linkAttachments('progress', id, input.attachmentIds);

    const stored = await query<ProgressRow>(`${SELECT_ENTRIES} WHERE e.id = $1`, [id]);
    const attachments = await listAttachments('progress', [id]);
    return toDto(stored.rows[0], attachments);
}
