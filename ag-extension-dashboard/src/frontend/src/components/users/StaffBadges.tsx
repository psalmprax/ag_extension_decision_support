import { Shield } from 'lucide-react';

interface StaffBadgesProps {
  roleLabel: string;
  roleClass: string;
  /** Demo-session account; the API only sends these to admins. */
  isDemo?: boolean;
}

/** Role badge, plus a "Demo" badge for the shared demo-session logins. */
export function StaffBadges({ roleLabel, roleClass, isDemo }: StaffBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium capitalize border ${roleClass}`}>
        <Shield className="w-2.5 h-2.5" aria-hidden="true" />
        {roleLabel}
      </span>
      {isDemo && (
        <span
          title="Shared demo login. Its data is hidden from real accounts."
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
        >
          Demo
        </span>
      )}
    </div>
  );
}
