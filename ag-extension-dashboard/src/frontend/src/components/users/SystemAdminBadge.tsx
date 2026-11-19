import { ShieldCheck } from 'lucide-react';

/** Marks an account that may create or promote administrators. */
export function SystemAdminBadge() {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
      <ShieldCheck className="w-3 h-3" />
      System admin
    </span>
  );
}
