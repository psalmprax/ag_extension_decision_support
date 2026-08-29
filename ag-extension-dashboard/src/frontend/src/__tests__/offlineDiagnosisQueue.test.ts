import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueSpecimenForAnalysis } from '@/services/offlineDiagnosisQueue';
import { syncQueue } from '@/api/syncQueueService';

vi.mock('@/api/syncQueueService', () => ({
  syncQueue: {
    enqueue: vi.fn(() => 'sync_test_id'),
  },
}));

describe('offline specimen diagnosis queue', () => {
  beforeEach(() => {
    vi.mocked(syncQueue.enqueue).mockClear();
  });

  it('queues the real image against the real analysis endpoint', () => {
    const id = queueSpecimenForAnalysis('base64-image-data', 'Coffee');

    expect(id).toBe('sync_test_id');
    expect(syncQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(syncQueue.enqueue).toHaveBeenCalledWith({
      action: 'create',
      entity: 'plant_image_diagnosis',
      endpoint: '/ai/diagnose/image',
      method: 'POST',
      data: { imageData: 'base64-image-data', cropType: 'Coffee' },
    });
  });

  it('never invents a crop or a diagnosis when crop context is missing', () => {
    queueSpecimenForAnalysis('base64-image-data');

    expect(syncQueue.enqueue).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(syncQueue.enqueue).mock.calls[0][0];
    expect(arg.data?.imageData).toBe('base64-image-data');
    expect(arg.data?.cropType).toBeUndefined();
    expect(arg.data?.offlineDiagnosis).toBeUndefined();
  });
});
