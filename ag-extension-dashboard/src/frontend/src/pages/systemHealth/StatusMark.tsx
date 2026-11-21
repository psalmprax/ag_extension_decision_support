import { Check, X } from 'lucide-react';

/** A check for a passing probe and a cross for a failing one, with words for screen readers. */
export function StatusMark({ ok }: { ok: boolean }) {
  const Icon = ok ? Check : X;
  return <Icon className="w-3.5 h-3.5 shrink-0" aria-label={ok ? 'ok' : 'failed'} />;
}
