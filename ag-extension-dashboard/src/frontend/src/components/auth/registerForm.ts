/** Roles the public form may offer: staff and admin accounts are created in-product. */
export type RegistrationRole = 'extension_officer' | 'farmer';

export interface RegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  organization: string;
  country: string;
  region: string;
  role: RegistrationRole;
}

/** Free-text inputs: everything except the two selects and the role picker. */
export const TEXT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
  'phone',
  'organization',
  'region',
] as const;

export type TextFieldName = (typeof TEXT_FIELDS)[number];

export const isTextFieldName = (name: string): name is TextFieldName =>
  (TEXT_FIELDS as readonly string[]).includes(name);

/** One shared style so every field on the card stays visually identical. */
export const FIELD_INPUT_CLASS =
  'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm';

export const FIELD_SELECT_CLASS =
  'w-full px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm';

export const FIELD_LABEL_CLASS = 'block text-xs font-medium text-white/70 mb-1.5';
