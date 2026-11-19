import type { User } from '@/store/useAppStore';

export interface AvatarPreset {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'agronomist', label: 'Agronomist', emoji: '🌾', gradient: 'from-emerald-600 to-teal-700' },
  { id: 'lead_farmer', label: 'Lead Farmer', emoji: '🧑‍🌾', gradient: 'from-amber-600 to-orange-700' },
  { id: 'field_officer', label: 'Field Officer', emoji: '🚜', gradient: 'from-blue-600 to-indigo-700' },
  { id: 'crop_scout', label: 'Crop Scout', emoji: '🌱', gradient: 'from-lime-600 to-emerald-700' },
  { id: 'soil_expert', label: 'Soil Scientist', emoji: '🔬', gradient: 'from-cyan-600 to-blue-700' },
  { id: 'satellite_analyst', label: 'Remote Sensing', emoji: '🛰️', gradient: 'from-purple-600 to-indigo-800' },
];

export const DEFAULT_PREFERENCES = {
  areaUnit: 'hectares',
  tempUnit: 'celsius',
  highContrast: false,
  smsAlerts: true,
  outbreakPush: true,
  weeklyDigest: false,
};

/** Hydrate the profile form from the browser's copy of the user's settings. */
export const getSavedProfileData = (user: User) => {
  let parsedPrefs: Partial<typeof DEFAULT_PREFERENCES>;
  let savedAvatar = 'agronomist';
  let savedUsername = `${(user.firstName || 'user').toLowerCase()}_${(user.lastName || 'officer').toLowerCase()}`;
  let savedPhone = '';
  try {
    const storedPrefs = localStorage.getItem(`gpexts_user_preferences:${user.id}`);
    parsedPrefs = storedPrefs ? JSON.parse(storedPrefs) as Partial<typeof DEFAULT_PREFERENCES> : {};
    savedAvatar = localStorage.getItem(`gpexts_user_avatar:${user.id}`) || savedAvatar;
    savedUsername = localStorage.getItem(`gpexts_user_handle:${user.id}`) || savedUsername;
    savedPhone = localStorage.getItem(`gpexts_user_phone:${user.id}`) || '';
  } catch {
    parsedPrefs = {};
  }

  return { parsedPrefs, savedAvatar, savedUsername, savedPhone };
};
