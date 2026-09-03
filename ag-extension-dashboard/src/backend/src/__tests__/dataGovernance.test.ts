import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const queryMock = jest.fn();
jest.mock('@/services/databaseService', () => ({
  query: queryMock,
}));

import { getFarmerForPrincipal } from '@/services/dataGovernanceService';
import { saveUpload } from '@/services/uploadService';

describe('data governance contracts', () => {
  const uploadDir = path.join(os.tmpdir(), `ag-extension-governance-${process.pid}`);

  beforeEach(() => {
    queryMock.mockReset();
    process.env.UPLOAD_DIR = uploadDir;
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  it('fails closed when a farmer and principal belong to different tenants', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'farmer-1', user_id: 'owner-1', assigned_officer_id: 'officer-1', region: 'Central', tenant_id: 'tenant-a', is_active: true }],
      })
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'tenant-b' }] });

    await expect(getFarmerForPrincipal('farmer-1', { userId: 'officer-1', role: 'extension_officer' }))
      .resolves.toBeNull();
  });

  it('allows an assigned officer in the same tenant', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'farmer-1', user_id: 'owner-1', assigned_officer_id: 'officer-1', region: 'Central', tenant_id: 'tenant-a', is_active: true }],
      })
      .mockResolvedValueOnce({ rows: [{ tenant_id: 'tenant-a' }] });

    await expect(getFarmerForPrincipal('farmer-1', { userId: 'officer-1', role: 'extension_officer' }))
      .resolves.toMatchObject({ id: 'farmer-1' });
  });

  it('rejects an upload that would exceed the per-user storage quota before scanning or writing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ used: String(500 * 1024 * 1024) }] });
    await expect(saveUpload({
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('image')]),
      originalName: 'photo.png',
      mimeType: 'image/png',
      ownerUserId: 'officer-1',
    })).rejects.toThrow(/Storage quota exceeded/);
    expect(queryMock).toHaveBeenCalledTimes(1); // no INSERT after the quota rejection
  });

  it('rejects a PNG whose bytes do not match the declared MIME type', async () => {
    await expect(saveUpload({
      buffer: Buffer.from('not a png'),
      originalName: 'photo.png',
      mimeType: 'image/png',
      ownerUserId: 'officer-1',
    })).rejects.toThrow('does not match the declared type');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('stores a content-validated upload with an opaque key', async () => {
    // 1) per-user quota lookup  2) insert of the upload record
    queryMock
      .mockResolvedValueOnce({ rows: [{ used: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'upload-1', tenant_id: 'tenant-a' }] });
    const result = await saveUpload({
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('image')]),
      originalName: '../../field photo.png',
      mimeType: 'image/png',
      ownerUserId: 'officer-1',
    });

    expect(result.id).toBe('upload-1');
    expect(result.storageKey).toMatch(/^[a-f0-9-]+\.png$/);
    expect(result.originalName).toBe('field_photo.png');
    expect(result.url).toContain('/api/v1/upload/file/');
  });
});
