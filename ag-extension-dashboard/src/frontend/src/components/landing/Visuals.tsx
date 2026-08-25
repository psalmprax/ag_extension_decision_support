import React from 'react';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

/**
 * Tiny inline SVG sparkline used in landing page stat cards.
 * Pure presentational — no external state.
 */
export function Sparkline({ data, color, width = 80, height = 28 }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient
          id={`spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
      />
    </svg>
  );
}

interface TelemetryNode {
  x: number;
  y: number;
}

interface ConstellationProps {
  nodes: TelemetryNode[];
}

/**
 * Stylized world lat/long concentric rings + inter-hub telemetry arcs.
 * Used as an absolutely-positioned decorative backdrop (xl screens only).
 */
export function GlobalConstellationVisualization({ nodes }: ConstellationProps) {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[540px] h-[540px] opacity-[0.08] pointer-events-none hidden xl:block">
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="46"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.25"
          strokeDasharray="2,2"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="24"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="1.5,1.5"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="12"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.15"
          strokeDasharray="1,1"
        />
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="96"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />

        {/* Inter-hub telemetry orbital arcs */}
        {nodes.map((node, i) =>
          nodes
            .slice(i + 1, i + 4)
            .map((other, j) => (
              <line
                key={`${i}-${j}`}
                x1={node.x}
                y1={node.y}
                x2={other.x}
                y2={other.y}
                stroke="var(--color-outline)"
                strokeWidth="0.18"
                strokeDasharray="1.5,1.5"
              />
            ))
        )}

        {/* Global Telemetry Beacons */}
        {nodes.map((node, i) => (
          <g key={i}>
            <circle cx={node.x} cy={node.y} r="1.6" fill="var(--color-outline)">
              <animate
                attributeName="r"
                values="1.2;3.2;1.2"
                dur={`${2.2 + (i % 4) * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0.15;0.7"
                dur={`${2.2 + (i % 4) * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle cx={node.x} cy={node.y} r="0.6" fill="var(--color-outline)" />
          </g>
        ))}
      </svg>
    </div>
  );
}