import { zipSync, strToU8 } from 'fflate';

const mockQuery = jest.fn();
const mockSaveUpload = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/dataGovernanceService', () => ({ getPrincipalTenantId: jest.fn() }));
jest.mock('@/services/uploadService', () => ({ saveUpload: (...args: unknown[]) => mockSaveUpload(...args) }));

import { importRecordings } from '@/services/partners/recordingImport';
import { parseCsv, readZip, ArchiveError } from '@/services/archives/zipEntries';

const PARTNER = '6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f';
const zip = (files: Record<string, string | Uint8Array>) =>
    Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]))));

describe('reading archives', () => {
    it('reads quoted CSV cells that contain commas', () => {
        expect(parseCsv('file,title\n"a.mp3","Spacing, rows and depth"\n')).toEqual([{ file: 'a.mp3', title: 'Spacing, rows and depth' }]);
    });

    it('refuses an archive with a path that climbs out of it', () => {
        const evil = zip({ '../escape.mp3': 'x' });
        expect(() => readZip(evil)).toThrow(ArchiveError);
    });

    it('says plainly when the upload is not a zip', () => {
        expect(() => readZip(Buffer.from('not a zip'))).toThrow('This is not a readable zip archive.');
    });
});

describe('importing a partner library', () => {
    beforeEach(() => {
        mockQuery.mockReset().mockResolvedValue({ rows: [{}], rowCount: 1 });
        mockSaveUpload.mockReset().mockResolvedValue({ id: 'upload-1' });
    });

    it('imports rows with speaker, language, licence and consent, and reports the rest', async () => {
        const manifest = [
            'file,title,speaker,language,crops,regions,topic,licence,licence_expires,consent',
            'armyworm.mp3,Fall armyworm scouting,Dr. Wanjiru,sw,maize;sorghum,Nakuru,pests,CC BY 4.0,,yes',
            'soil.mp3,Soil testing,,sw,maize,,soil,CC BY 4.0,,yes',
            'beans.mp3,Bean spacing,J. Banda,ny,beans,,planting,CC BY 4.0,,no',
            'missing.mp3,Not in the zip,J. Banda,ny,beans,,planting,CC BY 4.0,,yes',
            'notes.txt,Not audio,J. Banda,ny,beans,,planting,CC BY 4.0,,yes',
        ].join('\n');
        const archive = zip({ 'library/manifest.csv': manifest, 'library/armyworm.mp3': new Uint8Array([0xff, 0xfb, 0x90]), 'library/soil.mp3': 'x', 'library/beans.mp3': 'x', 'library/notes.txt': 'x' });

        const report = await importRecordings('admin-1', PARTNER, archive);

        expect(report.imported).toBe(1);
        expect(report.skipped.map(s => s.reason)).toEqual([
            'Who is speaking is missing',
            'The speaker’s consent is not confirmed',
            'The file is not in the archive',
            'Not an audio file (mp3, m4a, ogg, wav, aac or webm)',
        ]);
        expect(mockSaveUpload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/mpeg', quotaExempt: true }));
        const insert = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO partner_recordings'));
        expect(insert?.[1]).toEqual([PARTNER, 'upload-1', 'Fall armyworm scouting', 'Dr. Wanjiru', 'sw', ['maize', 'sorghum'], ['Nakuru'], 'pests', 'CC BY 4.0', null, 'admin-1']);
    });

    it('asks for a manifest when the archive has none', async () => {
        await expect(importRecordings('admin-1', PARTNER, zip({ 'a.mp3': 'x' }))).rejects.toThrow(/manifest\.csv/);
    });
});
