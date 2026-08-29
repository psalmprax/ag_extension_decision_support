import { syncQueue } from '@/api/syncQueueService';

/**
 * Offline handling for plant image diagnosis.
 *
 * There is no on-device vision model: disease diagnosis requires the backend.
 * When the device is offline, the captured specimen is queued in localStorage
 * and replayed against the real analysis endpoint when connectivity returns,
 * so any eventual diagnosis is always produced by the live service.
 */
export function queueSpecimenForAnalysis(imageData: string, cropType?: string): string {
  return syncQueue.enqueue({
    action: 'create',
    entity: 'plant_image_diagnosis',
    endpoint: '/ai/diagnose/image',
    method: 'POST',
    data: {
      imageData,
      cropType,
    },
  });
}
