export interface DirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  region: string;
  country?: string;
  phone: string;
  isActive?: boolean | null;
  lastLogin?: string | null;
  isDemo?: boolean;
  /** Above every tenant: the only flag that may create or promote an admin. */
  isSystemAdmin?: boolean;
  /** Regional manager an extension officer reports to, when linked. */
  managerId?: string | null;
  planId?: string | null;
  planName?: string | null;
  planStatus?: string | null;
  isFree?: boolean;
  planExpiresAt?: string | null;
}

export const USER_ROLES = [
  {
    value: 'admin',
    label: 'Admin',
    labelKey: 'users_role_admin',
    color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  {
    value: 'regional_manager',
    label: 'Regional Manager',
    labelKey: 'users_role_regional_manager',
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  {
    value: 'extension_officer',
    label: 'Extension Officer',
    labelKey: 'users_role_extension_officer',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    value: 'farmer',
    label: 'Farmer',
    labelKey: 'users_role_farmer',
    color: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
] as const;

export const getRoleBadge = (role: string) =>
  USER_ROLES.find(r => r.value === role) || USER_ROLES[2];

/**
 * Roles an actor may assign. `admin` is reserved for the system administrator;
 * the server enforces the same rule, so hiding it here is usability, not the
 * security boundary.
 */
export const assignableRoles = (actorIsSystemAdmin: boolean | undefined) =>
  actorIsSystemAdmin ? USER_ROLES : USER_ROLES.filter(role => role.value !== 'admin');

/**
 * Role choices for an existing user: the roles the actor may assign, plus the user's
 * current role when it is not one of them (so the select can show what is set).
 */
export const roleOptionsFor = (actorIsSystemAdmin: boolean | undefined, currentRole: string) => {
  const choices = assignableRoles(actorIsSystemAdmin);
  const current = USER_ROLES.find(r => r.value === currentRole);
  return choices.some(r => r.value === currentRole) || !current ? choices : [...choices, current];
};
