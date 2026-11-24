import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), request: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));

import { createCropCycle, createField, deleteField, fetchFields } from '@/api/fieldService';
import { fieldRecordsService } from '@/api/fieldRecordsService';
import { syncQueue } from '@/api/syncQueueService';
import { forgetOfflineReads, recallRead, setDeviceOwner } from '@/lib/offlineReadCache';

let online = true;
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

const noConnection = () => new AxiosError('Network Error', 'ERR_NETWORK');
const refused = (status: number, error: string) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status, statusText: '', data: { success: false, error }, headers: {}, config: { headers: new AxiosHeaders() },
  });

const FARMER = '11111111-1111-4111-8111-111111111111';
const serverField = { id: '22222222-2222-4222-8222-222222222222', farmerId: FARMER, name: 'North plot', areaHectares: 2, isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01', cropCycles: [] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  for (const owner of ['officer-1', 'officer-2']) {
    setDeviceOwner(owner);
    syncQueue.clear();
  }
  localStorage.clear();
  Object.values(api).forEach(fn => fn.mockReset());
  setDeviceOwner('officer-1');
  online = true;
});

describe('fields saved without a connection', () => {
  it('keeps a new field on the device under its own id and shows it as waiting', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [serverField] } });
    await fetchFields(FARMER);

    online = false;
    const saved = await createField({ farmerId: FARMER, name: 'Walked plot', areaHectares: 0.6 });
    expect(saved).toEqual({ success: true, queued: true });
    expect(api.post).not.toHaveBeenCalled();

    const [queued] = syncQueue.getQueue();
    expect(queued).toMatchObject({ entity: 'field', method: 'POST', endpoint: '/v1/fields', ownerId: 'officer-1', label: 'New field: Walked plot' });
    expect(String(queued.data?.id)).toMatch(UUID);

    api.get.mockRejectedValueOnce(noConnection());
    const list = await fetchFields(FARMER);
    expect(list.offline).toBe(true);
    expect(list.data.map(field => [field.name, field.pendingSync ?? false])).toEqual([['North plot', false], ['Walked plot', true]]);
  });

  it('queues a write that loses its connection on the way, and records that refer to it', async () => {
    api.post.mockRejectedValueOnce(noConnection());
    await createField({ farmerId: FARMER, name: 'River plot', areaHectares: 1 });
    const fieldId = String(syncQueue.getQueue()[0].data?.id);

    online = false;
    await createCropCycle(fieldId, { cropName: 'Beans', status: 'growing' });
    const { queued, test } = await fieldRecordsService.addSoilTest(fieldId, { testedAt: '2026-03-14', ph: 6.2 });
    expect(queued).toBe(true);
    expect(test).toMatchObject({ fieldId, ph: 6.2, pendingSync: true });

    expect(syncQueue.getQueue().map(item => item.endpoint)).toEqual(['/v1/fields', `/v1/fields/${fieldId}/cycles`, `/v1/fields/${fieldId}/soil-tests`]);
    api.get.mockRejectedValue(noConnection());
    const [field] = (await fetchFields(FARMER)).data;
    expect(field.cropCycles?.[0]).toMatchObject({ cropName: 'Beans', pendingSync: true });
    expect(await fieldRecordsService.soilTests(fieldId)).toEqual([expect.objectContaining({ ph: 6.2, pendingSync: true })]);
  });

  it('hides a field deleted offline', async () => {
    localStorage.clear();
    api.get.mockResolvedValueOnce({ data: { success: true, data: [serverField] } });
    await fetchFields(FARMER);
    online = false;
    await deleteField(serverField.id, serverField.name);
    api.get.mockRejectedValueOnce(noConnection());
    expect((await fetchFields(FARMER)).data).toEqual([]);
  });

  it('still reports a refusal from the server instead of queueing it', async () => {
    api.post.mockRejectedValueOnce(refused(400, 'soilPh: Number must be less than or equal to 14'));
    await expect(createField({ farmerId: FARMER, name: 'Bad', areaHectares: 1, soilPh: 19 })).rejects.toBeInstanceOf(AxiosError);
    expect(syncQueue.getPendingCount()).toBe(0);
  });
});

describe('one phone, two people', () => {
  it("neither shows nor sends another person's waiting writes", async () => {
    online = false;
    await createField({ farmerId: FARMER, name: 'Mine', areaHectares: 1 });
    setDeviceOwner('officer-2');
    expect(syncQueue.getPendingCount()).toBe(0);

    online = true;
    await syncQueue.processQueue();
    expect(api.request).not.toHaveBeenCalled();

    setDeviceOwner('officer-1');
    expect(syncQueue.getPendingCount()).toBe(1);
  });

  it('forgets the copies kept for offline use on sign-out', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [serverField] } });
    await fetchFields(FARMER);
    expect(recallRead(`fields:${FARMER}`)).not.toBeNull();
    forgetOfflineReads();
    expect(recallRead(`fields:${FARMER}`)).toBeNull();
  });
});

describe('sending waiting writes', () => {
  it('treats a delete the server no longer finds as done', async () => {
    online = false;
    await deleteField(serverField.id, serverField.name);
    online = true;
    api.request.mockRejectedValueOnce(refused(404, 'Field not found'));
    expect(await syncQueue.processQueue()).toEqual({ success: 1, failed: 0, conflicts: 0 });
    expect(syncQueue.getPendingCount()).toBe(0);
  });
});
