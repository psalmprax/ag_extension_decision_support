import { describe, it, expect, vi } from 'vitest';
import { fetchContextMenu, getDefaultContextMenu } from '@/api/contextMenuService';
import { createShare } from '@/api/shareService';
import apiClient from '@/api/client';

describe('Demo isolation for ContextMenu and ShareService', () => {
  it('fetchContextMenu for demo entity returns default context menu without network request', async () => {
    const getSpy = vi.spyOn(apiClient, 'get');

    const result = await fetchContextMenu('farmer', 'demo-farmer-1');

    expect(result.success).toBe(true);
    expect(result.data.entityType).toBe('farmer');
    expect(result.data.sections.length).toBeGreaterThan(0);
    // Crucial guarantee: apiClient.get must not be called with a demo id
    expect(getSpy).not.toHaveBeenCalled();

    getSpy.mockRestore();
  });

  it('fetchContextMenu falls back to default menu if API call fails', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));

    const result = await fetchContextMenu('farmer', '11111111-2222-3333-4444-555555555555');

    expect(result.success).toBe(true);
    expect(result.data.entityType).toBe('farmer');
    expect(result.data.sections.some(s => s.id === 'quick_actions')).toBe(true);

    getSpy.mockRestore();
  });

  it('getDefaultContextMenu provides expected action items for farmer', () => {
    const menu = getDefaultContextMenu('farmer', 'demo-farmer-1');
    const allActions = menu.sections.flatMap(s => s.items.map(i => i.action));

    expect(allActions).toContain('view_farmer');
    expect(allActions).toContain('schedule_visit');
    expect(allActions).toContain('share_farmer');
    expect(allActions).toContain('export_farmer');
    expect(allActions).toContain('delete_farmer');
  });

  it('createShare for demo entity returns synthetic share link without network request', async () => {
    const postSpy = vi.spyOn(apiClient, 'post');

    const result = await createShare({
      entityType: 'farmer',
      entityId: 'demo-farmer-1',
      accessType: 'restricted',
      expiresInDays: 7,
      permissions: { canView: true, canExport: true },
    });

    expect(result.success).toBe(true);
    expect(result.data?.shareId).toBeDefined();
    expect(result.data?.shareUrl).toContain('/share/demo-share-farmer');
    expect(result.data?.accessType).toBe('restricted');
    // Crucial guarantee: apiClient.post must not be called with demo id
    expect(postSpy).not.toHaveBeenCalled();

    postSpy.mockRestore();
  });
});
