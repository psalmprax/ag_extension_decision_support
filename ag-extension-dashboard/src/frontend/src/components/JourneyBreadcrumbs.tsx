import React from 'react';
import { ChevronRight, Clock, Radio } from 'lucide-react';

export interface JourneyStep {
  label: string;
  dwellTime?: string;
  status?: 'completed' | 'active' | 'pending';
}

interface JourneyBreadcrumbsProps {
  steps: JourneyStep[];
  className?: string;
}

export const JourneyBreadcrumbs: React.FC<JourneyBreadcrumbsProps> = ({
  steps,
  className = '',
}) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto py-1 text-[11px] font-mono no-scrollbar ${className}`}>
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
        <Clock className="w-3 h-3 text-slate-400" />
        Path:
      </span>

      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isActive = step.status === 'active' || isLast;

        return (
          <React.Fragment key={idx}>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 transition-all ${
                isActive
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold shadow-sm'
                  : 'bg-slate-800/60 border border-slate-700/40 text-slate-400'
              }`}
            >
              {isActive && <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />}
              <span>{step.label}</span>
              {step.dwellTime && (
                <span className="text-[9px] text-slate-400 opacity-80 font-normal">
                  ({step.dwellTime})
                </span>
              )}
            </div>

            {!isLast && (
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
