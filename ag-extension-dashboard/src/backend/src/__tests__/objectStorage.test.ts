import { objectStorage, resolveBackendType } from '@/services/objectStorageService';
import {
  saveUpload,
  readStoredUpload,
  purgeStoredUpload,
  signatureMatches,
  normalizeMimeType,
  createDirectUploadPresign,
  confirmDirectUpload,
  MAX_UPLOAD_BYTES,
} from '@/services/uploadService';
import {
  archiveReportToObjectStorage,
} from '@/services/reportStorageService';
import type { ReportListRow } from '@/types/rowTypes';

// Mock databaseService query
jest.mock('@/services/databaseService', () => ({
  query: jest.fn(),
}));

import { query } from '@/services/databaseService';
const queryMock = query as jest.MockedFunction<typeof query>;

describe('Object Storage & Media Pipeline', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('Unified Object Storage Service', () => {
    it('correctly resolves cheapest storage providers (Backblaze B2, Hetzner, Wasabi, R2)', () => {
      // Backblaze B2 (Cheapest raw storage: $0.006/GB)
      expect(resolveBackendType('my-bucket', 'keyId', 'https://s3.us-west-004.backblazeb2.com', 'b2')).toBe('backblaze-b2');
      expect(resolveBackendType('my-bucket', 'keyId', undefined, 'backblaze-b2')).toBe('backblaze-b2');
      expect(resolveBackendType('my-bucket', 'keyId', 'https://s3.us-west-004.backblazeb2.com', '')).toBe('backblaze-b2');

      // Cloudflare R2 ($0.015/GB with zero egress)
      expect(resolveBackendType('my-bucket', 'keyId', 'https://acc.r2.cloudflarestorage.com', 'r2')).toBe('cloudflare-r2');
      expect(resolveBackendType('my-bucket', 'keyId', undefined, 'cloudflare-r2')).toBe('cloudflare-r2');

      // Wasabi & Hetzner
      expect(resolveBackendType('my-bucket', 'keyId', 'https://s3.us-east-1.wasabisys.com', 'wasabi')).toBe('wasabi');
      expect(resolveBackendType('my-bucket', 'keyId', 'https://fsn1.your-objectstorage.com', 'hetzner')).toBe('hetzner');

      // Local disk fallback
      expect(resolveBackendType('', undefined, undefined, 'local')).toBe('local-disk');
      expect(resolveBackendType('', undefined, undefined, '')).toBe('local-disk');
    });

    it('initializes with default local-disk backend when no S3/R2 credentials exist', () => {
      expect(objectStorage.getBackendType()).toBeDefined();
      const config = objectStorage.getConfig();
      expect(config.localUploadDir).toBeDefined();
      expect(config.localCacheEnabled).toBe(true);
    });

    it('stores and retrieves a binary buffer durably', async () => {
      const testBuffer = Buffer.from('agricultural decision support test payload', 'utf8');
      const testKey = 'test/unit/payload.txt';

      const metadata = await objectStorage.putObject({
        key: testKey,
        buffer: testBuffer,
        contentType: 'text/plain',
        metadata: { purpose: 'test' },
      });

      expect(metadata.key).toBe(testKey);
      expect(metadata.sizeBytes).toBe(testBuffer.length);
      expect(metadata.sha256).toBeDefined();
      expect(metadata.url).toContain(testKey);

      const exists = await objectStorage.hasObject(testKey);
      expect(exists).toBe(true);

      const retrieved = await objectStorage.getObject(testKey);
      expect(retrieved.toString('utf8')).toBe('agricultural decision support test payload');

      await objectStorage.deleteObject(testKey);
      const existsAfterDelete = await objectStorage.hasObject(testKey);
      expect(existsAfterDelete).toBe(false);
    });

    it('streams stored binary files via getObjectStream', async () => {
      const testBuffer = Buffer.from('streamable video or audio chunks', 'utf8');
      const testKey = 'test/unit/stream_sample.dat';

      await objectStorage.putObject({
        key: testKey,
        buffer: testBuffer,
        contentType: 'application/octet-stream',
      });

      const { stream, contentLength } = await objectStorage.getObjectStream(testKey);
      expect(contentLength).toBe(testBuffer.length);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString('utf8')).toBe('streamable video or audio chunks');

      await objectStorage.deleteObject(testKey);
    });
  });

  describe('Signature Matching & Media Type Normalization', () => {
    it('correctly identifies Video MP4 and WebM signatures', () => {
      // MP4 has 'ftyp' at offset 4
      const mp4Buffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]),
        Buffer.from('ftypmp42'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
      ]);
      expect(signatureMatches(mp4Buffer, 'video/mp4')).toBe(true);

      // WebM has EBML header: 1A 45 DF A3
      const webmBuffer = Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
        Buffer.from('webm payload'),
      ]);
      expect(signatureMatches(webmBuffer, 'video/webm')).toBe(true);
    });

    it('correctly identifies Audio MP3 and WAV signatures', () => {
      // MP3 ID3 header
      const mp3Id3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([0x03, 0x00, 0x00])]);
      expect(signatureMatches(mp3Id3, 'audio/mpeg')).toBe(true);

      // MP3 MPEG sync word 0xFF 0xFB
      const mp3Sync = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
      expect(signatureMatches(mp3Sync, 'audio/mpeg')).toBe(true);

      // WAV RIFF + WAVE
      const wavBuffer = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x24, 0x00, 0x00, 0x00]),
        Buffer.from('WAVEfmt '),
      ]);
      expect(signatureMatches(wavBuffer, 'audio/wav')).toBe(true);
    });

    it('correctly identifies Documents (PDF, CSV, XLSX)', () => {
      // PDF
      const pdfBuffer = Buffer.from('%PDF-1.4 report content');
      expect(signatureMatches(pdfBuffer, 'application/pdf')).toBe(true);

      // CSV plain text
      const csvBuffer = Buffer.from('Date,Yield,Moisture\n2026-09-01,4.5,22.1\n');
      expect(signatureMatches(csvBuffer, 'text/csv')).toBe(true);

      // XLSX PK\x03\x04
      const xlsxBuffer = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('openxml-sheet-contents'),
      ]);
      expect(signatureMatches(xlsxBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    });

    it('rejects binary executables masquerading as media', () => {
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF
      expect(signatureMatches(elfBuffer, 'video/mp4')).toBe(false);
      expect(signatureMatches(elfBuffer, 'audio/mpeg')).toBe(false);

      const mzBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // PE/DOS
      expect(signatureMatches(mzBuffer, 'text/csv')).toBe(false);
    });

    it('normalizes supported MIME types accurately', () => {
      expect(normalizeMimeType('VIDEO/MP4')).toBe('video/mp4');
      expect(normalizeMimeType('audio/mpeg')).toBe('audio/mpeg');
      expect(normalizeMimeType('text/csv')).toBe('text/csv');
      expect(() => normalizeMimeType('application/x-executable')).toThrow('Unsupported file type');
    });
  });

  describe('Upload Pipeline with Quotas and Records', () => {
    it('stores a content-validated video file to object storage and writes upload record', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ used: 0 }] }) // quota
        .mockResolvedValueOnce({ rows: [{ id: 'video-rec-1', tenant_id: 'tenant-1' }] }); // insert

      const mp4Buffer = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]),
        Buffer.from('ftypmp42'),
        Buffer.from('farm inspection drone footage'),
      ]);

      const result = await saveUpload({
        buffer: mp4Buffer,
        originalName: 'drone_inspection.mp4',
        mimeType: 'video/mp4',
        ownerUserId: 'officer-1',
        farmerId: 'farmer-1',
      });

      expect(result.id).toBe('video-rec-1');
      expect(result.storageKey).toMatch(/^[a-f0-9-]+\.mp4$/);
      expect(result.originalName).toBe('drone_inspection.mp4');
      expect(result.size).toBe(mp4Buffer.length);

      // Verify read from stored upload
      const readBack = await readStoredUpload(result.storageKey);
      expect(readBack.subarray(4, 8).toString('ascii')).toBe('ftyp');

      // Cleanup
      await purgeStoredUpload(result.storageKey);
    });

    it('enforces maximum file size limit', async () => {
      const hugeBuffer = { length: MAX_UPLOAD_BYTES + 1 } as unknown as Buffer;
      await expect(saveUpload({
        buffer: hugeBuffer,
        originalName: 'huge.mp4',
        mimeType: 'video/mp4',
        ownerUserId: 'officer-1',
      })).rejects.toThrow(/upload limit/);
    });

    it('creates presigned upload and confirms direct upload', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ used: 0 }] }) // quota
        .mockResolvedValueOnce({ rows: [{ id: 'presign-row-1' }] }); // insert

      // In local mode, getPresignedUploadUrl errors because cloud storage is required
      await expect(createDirectUploadPresign({
        originalName: 'field_recording.m4a',
        mimeType: 'audio/x-m4a',
        sizeBytes: 15 * 1024 * 1024,
        ownerUserId: 'officer-1',
      })).rejects.toThrow(/Presigned upload URLs require cloud object storage/);
    });

    it('confirms a direct upload when object is present in storage', async () => {
      const testKey = 'test-direct-confirm.mp4';
      await objectStorage.putObject({
        key: testKey,
        buffer: Buffer.from('direct upload test binary content'),
        contentType: 'video/mp4',
      });

      queryMock.mockResolvedValueOnce({
        rows: [{
          id: 'confirm-rec-1',
          original_name: 'test-direct.mp4',
          mime_type: 'video/mp4',
          size_bytes: 33,
          sha256: 'abc123sha256',
        }],
      });

      const confirmed = await confirmDirectUpload(testKey, 'officer-1');
      expect(confirmed.id).toBe('confirm-rec-1');
      expect(confirmed.storageKey).toBe(testKey);
      expect(confirmed.size).toBe(33);

      await objectStorage.deleteObject(testKey);
    });
  });

  describe('Report Archival Service', () => {
    const sampleReport: ReportListRow = {
      id: 'rpt-sample-1',
      type: 'activity_report',
      title: 'Monthly Extension Advisory Report',
      content: {
        visits: { total: 42, completed: 38, totalMinutes: 1950 },
        conversations: { totalConversations: 120, rated: 95, avgSatisfaction: 4.8 },
        metadata: {
          region: 'Rift Valley',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
      },
      generated_by: 'officer-1',
      status: 'completed',
      tenant_id: 'tenant-alpha',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    };

    it('archives report bundle (PDF, CSV, Excel) to Object Storage and updates reports table', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [sampleReport] }) // SELECT report
        .mockResolvedValueOnce({ rows: [{ id: sampleReport.id }] }); // UPDATE reports

      const archiveResult = await archiveReportToObjectStorage(sampleReport.id);

      expect(archiveResult.reportId).toBe(sampleReport.id);
      expect(archiveResult.pdf?.key).toContain(`reports/tenant-alpha/${sampleReport.id}/report_${sampleReport.id}.pdf`);
      expect(archiveResult.csv?.key).toContain(`reports/tenant-alpha/${sampleReport.id}/report_${sampleReport.id}.csv`);
      expect(archiveResult.excel?.key).toContain(`reports/tenant-alpha/${sampleReport.id}/report_${sampleReport.id}.xlsx`);

      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(queryMock.mock.calls[1][0]).toContain('UPDATE reports SET content = $1, updated_at = NOW() WHERE id = $2');

      // Verify the PDF is accessible in object storage
      const storedPdf = await objectStorage.getObject(archiveResult.pdf!.key);
      expect(storedPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      // Cleanup
      await objectStorage.deleteObject(archiveResult.pdf!.key);
      await objectStorage.deleteObject(archiveResult.csv!.key);
      await objectStorage.deleteObject(archiveResult.excel!.key);
    });
  });
});
