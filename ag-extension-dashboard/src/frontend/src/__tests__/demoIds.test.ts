import { describe, it, expect } from 'vitest';
import { isDemoId, isDemoFarmerId, containsDemoId } from '@/demo/demoIds';
import apiClient from '@/api/client';

describe('demo id guard', () => {
  it('recognizes demo farmer ids', () => {
    expect(isDemoFarmerId('demo-farmer-1')).toBe(true);
    expect(isDemoFarmerId('demo-farmer-12')).toBe(true);
    expect(isDemoFarmerId('11111111-1111-1111-1111-111111111111')).toBe(false);
  });

  it('recognizes every demo id shape', () => {
    expect(isDemoId('demo-farmer-1')).toBe(true);
    expect(isDemoId('field-demo-1')).toBe(true);
    expect(isDemoId('demo-v1')).toBe(true);
    expect(isDemoId('demo-r1')).toBe(true);
    expect(isDemoId('demo-kb')).toBe(true);
    expect(isDemoId('11111111-1111-1111-1111-111111111111')).toBe(false);
    expect(isDemoId(undefined)).toBe(false);
    expect(isDemoId(null)).toBe(false);
  });

  it('detects demo ids inside request urls', () => {
    expect(containsDemoId('/api/v1/fields?farmerId=demo-farmer-1')).toBe(true);
    expect(containsDemoId('/api/v1/fields/field-demo-1/cycles')).toBe(true);
    expect(
      containsDemoId('/api/v1/fields?farmerId=11111111-1111-1111-1111-111111111111')
    ).toBe(false);
    // Legit demo-mode calls that carry no demo id must never be blocked.
    expect(containsDemoId('/api/v1/notifications/unread-count')).toBe(false);
    expect(containsDemoId('/api/auth/demo')).toBe(false);
    expect(containsDemoId(undefined)).toBe(false);
  });

  it('blocks an outbound request carrying a demo id at the client boundary', async () => {
    await expect(apiClient.get('/v1/fields?farmerId=demo-farmer-1')).rejects.toMatchObject({
      code: 'ERR_DEMO_BLOCKED',
    });
  });
});
