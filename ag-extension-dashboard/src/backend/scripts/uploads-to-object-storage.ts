/**
 * Copies uploads kept on this server's disk into the configured object storage
 * (STORAGE_BACKEND=s3|r2 with S3_* or R2_*), so they survive the server and every
 * backend can read them. Safe to re-run: files already in the bucket are skipped.
 *
 *   docker exec ag-dashboard-backend npx ts-node -r tsconfig-paths/register --transpile-only scripts/uploads-to-object-storage.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { objectStorage } from '../src/services/objectStorageService';
import { query } from '../src/services/databaseService';

async function main(): Promise<void> {
    if (!objectStorage.isCloudConfigured()) {
        console.error('Object storage is not configured (STORAGE_BACKEND and S3_* or R2_*). Nothing copied.');
        process.exit(1);
    }
    const dir = objectStorage.getConfig().localUploadDir;
    const { rows } = await query<{ storage_key: string; mime_type: string }>(
        "SELECT storage_key, mime_type FROM upload_records WHERE status = 'active'",
    );
    let copied = 0; let present = 0; let missing = 0;
    for (const row of rows) {
        const key = path.basename(row.storage_key);
        if (await objectStorage.hasObject(key)) { present += 1; continue; }
        const buffer = await fs.readFile(path.join(dir, key)).catch(() => null);
        if (!buffer) { missing += 1; console.warn(`Not on this disk: ${key}`); continue; }
        await objectStorage.putObject({ key, buffer, contentType: row.mime_type });
        copied += 1;
    }
    console.log(`Copied ${copied}, already in storage ${present}, not found on disk ${missing}, of ${rows.length} uploads.`);
    process.exit(0);
}

main().catch(error => {
    console.error('Copy failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
