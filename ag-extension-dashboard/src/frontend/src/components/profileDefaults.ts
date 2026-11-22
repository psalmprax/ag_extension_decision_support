import type { LucideIcon } from 'lucide-react';
import { Microscope, Satellite, ScanSearch, Sprout, Tractor, Wheat } from 'lucide-react';
import type { User } from '@/store/useAppStore';
import { areaUnitFor, tempUnitFor } from '@/lib/units';
import { safeStorage } from '@/lib/safeStorage';

export interface AvatarPreset {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'agronomist', label: 'Agronomist', icon: Wheat },
  { id: 'lead_farmer', label: 'Lead farmer', icon: Sprout },
  { id: 'field_officer', label: 'Field officer', icon: Tractor },
  { id: 'crop_scout', label: 'Crop scout', icon: ScanSearch },
  { id: 'soil_expert', label: 'Soil scientist', icon: Microscope },
  { id: 'satellite_analyst', label: 'Remote sensing', icon: Satellite },
];

export const DEFAULT_PREFERENCES = {
  areaUnit: 'hectares',
  tempUnit: 'celsius',
  highContrast: false,
};

/**
 * Hydrate the profile form: the account's saved settings first, then this
 * browser's older copy (from before they were saved on the account).
 */
/**
 * This browser's copy of the profile, read back by getSavedProfileData. False when the
 * browser would not store all of it (blocked or full storage).
 */
export const saveProfileLocally = (userId: string | undefined, profile: { avatarId: string; username: string; phone: string }, preferences: unknown): boolean => [
  safeStorage.set(`gpexts_user_avatar:${userId}`, profile.avatarId),
  safeStorage.set(`gpexts_user_handle:${userId}`, profile.username),
  safeStorage.set(`gpexts_user_phone:${userId}`, profile.phone),
  safeStorage.set(`gpexts_user_preferences:${userId}`, JSON.stringify(preferences)),
].every(Boolean);

export const getSavedProfileData = (user: User) => {
  let parsedPrefs: Partial<typeof DEFAULT_PREFERENCES>;
  let savedAvatar = 'agronomist';
  let savedUsername = `${(user.firstName || 'user').toLowerCase()}_${(user.lastName || 'officer').toLowerCase()}`;
  let savedPhone = '';
  try {
    const storedPrefs = safeStorage.get(`gpexts_user_preferences:${user.id}`);
    parsedPrefs = storedPrefs ? JSON.parse(storedPrefs) as Partial<typeof DEFAULT_PREFERENCES> : {};
    savedAvatar = safeStorage.get(`gpexts_user_avatar:${user.id}`) || savedAvatar;
    savedUsername = safeStorage.get(`gpexts_user_handle:${user.id}`) || savedUsername;
    savedPhone = safeStorage.get(`gpexts_user_phone:${user.id}`) || '';
  } catch {
    parsedPrefs = {};
  }

  const account = user.profileSettings ?? {};
  const { handle, avatarId, ...units } = account;
  // Until someone picks units, show the ones their country uses (what the app already displays).
  const countryDefaults = {
    areaUnit: areaUnitFor(undefined, user.country) === 'acre' ? 'acres' : 'hectares',
    tempUnit: tempUnitFor(undefined, user.country),
  };
  return {
    parsedPrefs: { ...countryDefaults, ...parsedPrefs, ...units },
    savedAvatar: avatarId || savedAvatar,
    savedUsername: handle || savedUsername,
    savedPhone,
  };
};
