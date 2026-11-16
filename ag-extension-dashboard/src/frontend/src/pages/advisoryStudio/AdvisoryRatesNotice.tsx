import React from 'react';
import { AlertTriangle } from 'lucide-react';

/** Shown in the studio: template rates are editable examples, not recommendations. */
export function AdvisoryRatesNotice() {
  return (
    <div role="note" className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs text-amber-200">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Rates and thresholds in templates are examples to edit. Confirm them with an agronomist and the product label for your crop and region before publishing.</span>
    </div>
  );
}
