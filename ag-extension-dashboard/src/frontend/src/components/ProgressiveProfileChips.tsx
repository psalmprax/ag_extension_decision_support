import React from 'react';
import { CheckCircle2, Clock3, Sparkles } from 'lucide-react';

export interface ProfileParameter {
  key: string;
  label: string;
  value?: string | number | null;
  required?: boolean;
}

interface ProgressiveProfileChipsProps {
  parameters: ProfileParameter[];
  title?: string;
  className?: string;
}

export const ProgressiveProfileChips: React.FC<ProgressiveProfileChipsProps> = ({
  parameters,
  title = 'Conversational Intake Profile',
  className = '',
}) => {
  const completedCount = parameters.filter(p => !!p.value).length;
  const totalCount = parameters.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className={`p-3 rounded bg-slate-950/70 border border-slate-800 space-y-2.5 backdrop-blur-md ${className}`}>
      {/* Top Completion Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-emerald-400">
            {completedCount}/{totalCount} ({percentage}%)
          </span>
          <div className="w-12 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-sm transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chips Cloud */}
      <div className="flex flex-wrap gap-1.5">
        {parameters.map(param => {
          const isFilled = !!param.value;
          return (
            <div
              key={param.key}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all ${
                isFilled
                  ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-500'
              }`}
            >
              {isFilled ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Clock3 className="w-3 h-3 text-slate-600 shrink-0" />
              )}
              <span className="font-semibold text-slate-400">{param.label}:</span>
              <span className={isFilled ? 'text-white font-bold' : 'italic text-slate-600'}>
                {param.value ? String(param.value) : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
