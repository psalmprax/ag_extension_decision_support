interface DemoIdentity {
  email?: string | null;
  isDemo?: boolean;
}

export function isDemoSession(user: DemoIdentity | null, requested: boolean): boolean {
  if (!user) return requested;
  return user.isDemo === true || user.email?.toLowerCase() === 'demo@agridemo.com';
}
