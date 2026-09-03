import React from 'react';
import { ShieldCheck, FlaskConical, Database, HelpCircle } from 'lucide-react';

/**
 * Provenance badge for pillar-service data.
 *
 * Renders the `provenance` block attached to pillar API responses so users can
 * see what a result is derived from before acting on it:
 *  - computed_from_supplied_inputs → "From your inputs" (green)
 *  - deterministic_estimation      → "Estimated" (amber)
 *  - demo_reference_data           → "Demo data" (orange)
 *  - unavailable                   → "No data" (red)
 */

export type ProvenanceKind =
  | 'computed_from_supplied_inputs'
  | 'deterministic_estimation'
  | 'demo_reference_data'
  | 'unavailable';

export interface PillarProvenance {
  kind: ProvenanceKind;
  assumptions: string[];
  demoData: boolean;
  note: string;
}

interface ProvenanceBadgeProps {
  provenance: PillarProvenance | null | undefined;
  /** `full` shows the note + assumptions in an expandable panel (default). */
  variant?: 'chip' | 'full';
}

const KIND_META: Record<ProvenanceKind, { label: string; icon: React.ElementType; chipClass: string; title: string }> = {
  computed_from_supplied_inputs: {
    label: 'From your inputs',
    icon: ShieldCheck,
    chipClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    title: 'Computed only from the values you supplied',
  },
  deterministic_estimation: {
    label: 'Estimated',
    icon: FlaskConical,
    chipClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    title: 'Fixed agronomic coefficients were applied — treat as an estimate',
  },
  demo_reference_data: {
    label: 'Demo data',
    icon: Database,
    chipClass: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    title: 'Records come from in-code demo/reference data, not a live source',
  },
  unavailable: {
    label: 'No data',
    icon: HelpCircle,
    chipClass: 'bg-red-500/10 text-red-400 border-red-500/25',
    title: 'The data source for this result is not available',
  },
};

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ provenance, variant = 'chip' }) => {
  if (!provenance?.kind) return null;

  const meta = KIND_META[provenance.kind] ?? KIND_META.deterministic_estimation;
  const Icon = meta.icon;

  if (variant === 'chip') {
    return (
      <span
        title={provenance.note || meta.title}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${meta.chipClass}`}
        data-testid="provenance-badge"
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs ${meta.chipClass}`}
      data-testid="provenance-panel"
      role="note"
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{meta.label}</span>
        <span className="font-normal opacity-70">— {meta.title.toLowerCase()}</span>
      </div>
      {provenance.note && <p className="mt-1 opacity-90 leading-relaxed">{provenance.note}</p>}
      {provenance.assumptions.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 opacity-80">
          {provenance.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProvenanceBadge;
