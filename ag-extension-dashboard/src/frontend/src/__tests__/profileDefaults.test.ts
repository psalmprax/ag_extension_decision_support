import { beforeEach, describe, expect, it } from 'vitest';
import { getSavedProfileData } from '@/components/profileDefaults';
import type { User } from '@/store/useAppStore';

const user: User = { id: 'u-1', firstName: 'Mary', lastName: 'Njeri', email: 'm@example.test', role: 'farmer' };

describe('profile handle and avatar', () => {
  beforeEach(() => localStorage.clear());

  it('come from the account, so they are the same on every device', () => {
    localStorage.setItem('gpexts_user_avatar:u-1', 'lead_farmer');
    const saved = getSavedProfileData({ ...user, profileSettings: { handle: 'mary.n', avatarId: 'crop_scout', areaUnit: 'acres' } });
    expect(saved.savedUsername).toBe('mary.n');
    expect(saved.savedAvatar).toBe('crop_scout');
    expect(saved.parsedPrefs.areaUnit).toBe('acres');
  });

  it('fall back to what this browser saved before they moved to the account', () => {
    localStorage.setItem('gpexts_user_avatar:u-1', 'lead_farmer');
    localStorage.setItem('gpexts_user_handle:u-1', 'mary_old');
    const saved = getSavedProfileData(user);
    expect(saved.savedAvatar).toBe('lead_farmer');
    expect(saved.savedUsername).toBe('mary_old');
  });
});
