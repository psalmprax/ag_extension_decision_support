import React from 'react';

type TooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => React.ReactNode;
  valueFormatter?: (value: string | number, name: string | number) => string;
}

/**
 * Theme-aware tooltip shared by all Recharts charts. Colors resolve through CSS
 * variables so the tooltip follows the active theme and dark mode automatically.
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="min-w-[140px] rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-outline-variant)',
        boxShadow: 'var(--shadow-premium)',
      }}
    >
      {label !== undefined && label !== null && label !== '' && (
        <p
          className="mb-1.5 text-xxs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-on-surface-variant)' }}
        >
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const color =
            entry.color ??
            (entry.payload?.fill as string | undefined) ??
            (entry.payload?.color as string | undefined) ??
            'var(--color-primary-500)';
          const name = entry.name ?? entry.dataKey ?? '';
          const rawValue = entry.value ?? '';
          const value = valueFormatter ? valueFormatter(rawValue, name) : String(rawValue);

          return (
            <div
              key={`${String(name)}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                {name}
              </span>
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: 'var(--color-on-surface)' }}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartTooltip;
