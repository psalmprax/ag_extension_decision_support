import * as XLSX from 'xlsx';

/** Minimal structural type for a Node.js readable stream that emits data/end/error. */
export type BinaryResponseStream = {
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
};

/**
 * Supertest parser that returns the raw response buffer instead of trying to
 * JSON-parse binary bodies. Without this, `response.body` for the XLSX export
 * comes back as a parsed object and `Buffer.from(String(response.body))`
 * produces a 15-byte garbage buffer.
 *
 * Note: supertest's `.parse()` signature requires its own `Response` type
 * which is structurally incompatible with `http.IncomingMessage`; the
 * `BinaryResponseStream` shape captures the 3 event subscriptions we actually
 * use and is accepted by supertest's parser type.
 */
export const binaryParser = (
    res: BinaryResponseStream,
    cb: (err: Error | null, body: Buffer) => void
): void => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
    res.on('error', (err: Error) => {
        // Surface the stream error instead of silently returning an empty buffer
        // eslint-disable-next-line no-console
        console.error('binaryParser stream error:', err);
        cb(err, Buffer.alloc(0));
    });
};

/** Read a sheet as a 2D array (header row + data rows), dropping blank rows. */
export const readSheet = (wb: XLSX.WorkBook, name: string): unknown[][] =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false }) as unknown[][];

/** Parse a raw XLSX response buffer into a workbook. */
export const parseXlsxBuffer = (buffer: Buffer): XLSX.WorkBook =>
    XLSX.read(buffer, { type: 'buffer' });

/**
 * Parse a CSV response body into a 2D array (mirrors `readSheet`).
 * Splits on `\n` + `,` and drops blank trailing rows from the route's
 * appended newlines. Does NOT handle quoted fields — adequate for the
 * simple `Metric,Value\n` CSV shape emitted by the reporting route.
 */
export const parseCsv = (text: string): string[][] =>
    text.split('\n').filter(line => line.trim() !== '').map(line => line.split(','));
