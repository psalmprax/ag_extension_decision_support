/**
 * Reading an uploaded zip archive safely: only regular files, no paths that climb out of
 * the archive, and hard caps on the number of files and their unpacked size, so a
 * crafted archive cannot exhaust memory.
 */
import { unzipSync } from 'fflate';

export const MAX_ARCHIVE_FILES = 2000;
export const MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;

export class ArchiveError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

export interface ArchiveFile {
    /** The path inside the archive, with forward slashes. */
    path: string;
    data: Buffer;
}

const isSafePath = (name: string) =>
    !name.startsWith('/') && !name.split('/').some(part => part === '..') && !/^[A-Za-z]:/.test(name);

/** Files of the archive (folders and macOS metadata skipped), in archive order. */
export function readZip(buffer: Buffer): ArchiveFile[] {
    let files = 0;
    let unpacked = 0;
    let entries: Record<string, Uint8Array>;
    try {
        entries = unzipSync(new Uint8Array(buffer), {
            filter: file => {
                if (file.name.endsWith('/') || file.name.startsWith('__MACOSX/') || file.name.split('/').pop()?.startsWith('.')) return false;
                if (!isSafePath(file.name)) throw new ArchiveError(`The archive has an unsafe path: ${file.name}`);
                files += 1;
                unpacked += file.originalSize;
                if (files > MAX_ARCHIVE_FILES) throw new ArchiveError(`An archive may hold at most ${MAX_ARCHIVE_FILES} files. Split it into smaller batches.`);
                if (unpacked > MAX_UNPACKED_BYTES) throw new ArchiveError('The archive unpacks to more than 1 GB. Split it into smaller batches.');
                return true;
            },
        });
    } catch (error) {
        if (error instanceof ArchiveError) throw error;
        throw new ArchiveError('This is not a readable zip archive.');
    }
    return Object.entries(entries).map(([path, data]) => ({ path, data: Buffer.from(data) }));
}

/** Splits one CSV line, honouring double-quoted fields that contain commas. */
function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (quoted && char === '"' && line[i + 1] === '"') { cell += '"'; i++; continue; }
        if (char === '"') { quoted = !quoted; continue; }
        if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; continue; }
        cell += char;
    }
    cells.push(cell.trim());
    return cells;
}

/** Rows of a CSV with a header line, as objects keyed by lower-cased header. */
export function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];
    const header = splitCsvLine(lines[0]).map(name => name.toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).map(line => {
        const cells = splitCsvLine(line);
        return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? '']));
    });
}
