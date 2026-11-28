import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const subscribeUserToPush = vi.fn(async () => null);
vi.mock('@/api/pushNotificationService', () => ({ subscribeUserToPush: () => subscribeUserToPush() }));
vi.mock('@/lib/swRegistration', () => ({ registerServiceWorker: vi.fn() }));

import { useAppBootstrap } from '../useAppBootstrap';

describe('push notification sign-up on start', () => {
  beforeEach(() => subscribeUserToPush.mockClear());

  const officer = { id: 'u1', email: 'officer@example.org' };
  const demo = { id: 'demo', email: 'demo@agridemo.com', isDemo: true };
  const setActiveTab = vi.fn();

  it('signs a real user up for push notifications', () => {
    renderHook(() => useAppBootstrap(officer, setActiveTab));
    expect(subscribeUserToPush).toHaveBeenCalledTimes(1);
  });

  it('does not try in the demo, which the server refuses with 403', () => {
    renderHook(() => useAppBootstrap(demo, setActiveTab));
    expect(subscribeUserToPush).not.toHaveBeenCalled();
  });
});
