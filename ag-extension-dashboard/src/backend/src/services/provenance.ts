/**
 * Shared provenance metadata for pillar services.
 *
 * Every pillar service serves deterministic computations over a mix of
 * caller-supplied inputs and static reference/estimation data. Consumers
 * (routes, future UI) must be able to tell what a result is derived from,
 * so each result carries a `provenance` block built here.
 *
 * Kinds:
 *  - computed_from_supplied_inputs: derived only from caller-provided values
 *    (pure math over request payloads). No fabricated data.
 *  - deterministic_estimation: uses fixed agronomic coefficients or constants
 *    (yields, costs, rates). Estimates, not measurements.
 *  - demo_reference_data: returned records come from an in-code static
 *    directory, not a live database or registry.
 *  - unavailable: the real data source is not integrated yet.
 */

export type ProvenanceKind =
  | 'computed_from_supplied_inputs'
  | 'deterministic_estimation'
  | 'demo_reference_data'
  | 'unavailable';

export interface PillarProvenance {
  kind: ProvenanceKind;
  /** Fixed coefficients, defaults, or reference values baked into the computation. */
  assumptions: string[];
  /** True when any returned record originates from in-code demo/seed data. */
  demoData: boolean;
  /** One-line note describing the computation honestly. */
  note: string;
}

export function pillarProvenance(
  kind: ProvenanceKind,
  note: string,
  assumptions: string[] = [],
  demoData = false
): PillarProvenance {
  return { kind, assumptions, demoData, note };
}
