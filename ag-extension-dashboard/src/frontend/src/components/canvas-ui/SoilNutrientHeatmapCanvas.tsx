import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Layers, Droplets, Activity, Gauge, Flame } from 'lucide-react';

export type SoilLayerType = 'ph' | 'nitrogen' | 'phosphorus' | 'potassium' | 'moisture' | 'carbon';

export interface SoilProbeResult {
  x: number;
  y: number;
  value: number;
  unit: string;
  label: string;
  status: 'optimal' | 'warning' | 'critical';
  recommendation: string;
}

export interface SoilNutrientHeatmapCanvasProps {
  initialLayer?: SoilLayerType;
  className?: string;
  onProbeSelect?: (result: SoilProbeResult) => void;
  interactive?: boolean;
}

interface TelemetrySamplePoint {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  val: number;
}

const LAYER_CONFIG: Record<
  SoilLayerType,
  {
    label: string;
    unit: string;
    min: number;
    max: number;
    optimalRange: [number, number];
    icon: React.ElementType;
    description: string;
    samplePoints: TelemetrySamplePoint[];
    colorStop: (t: number) => string;
  }
> = {
  ph: {
    label: 'Soil pH Reaction',
    unit: 'pH',
    min: 4.0,
    max: 8.5,
    optimalRange: [6.0, 7.2],
    icon: Activity,
    description: 'Procedural preview — not live SoilGrids data; connect a real soil test to populate',
    samplePoints: [
      { x: 0.15, y: 0.2, val: 5.1 },
      { x: 0.35, y: 0.7, val: 6.4 },
      { x: 0.5, y: 0.35, val: 6.8 },
      { x: 0.8, y: 0.25, val: 4.8 },
      { x: 0.75, y: 0.8, val: 7.1 },
      { x: 0.25, y: 0.85, val: 5.6 },
    ],
    colorStop: (t: number) => {
      // Red (acidic) -> Emerald (optimal) -> Blue/Violet (alkaline)
      if (t < 0.4) {
        // 0..0.4: Crimson to Amber
        const k = t / 0.4;
        const r = Math.round(239 + (245 - 239) * k);
        const g = Math.round(68 + (158 - 68) * k);
        const b = Math.round(68 + (11 - 68) * k);
        return `rgb(${r}, ${g}, ${b})`;
      } else if (t < 0.75) {
        // 0.4..0.75: Amber to Emerald
        const k = (t - 0.4) / 0.35;
        const r = Math.round(245 + (16 - 245) * k);
        const g = Math.round(158 + (185 - 158) * k);
        const b = Math.round(11 + (129 - 11) * k);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // 0.75..1.0: Emerald to Deep Cyan/Indigo
        const k = (t - 0.75) / 0.25;
        const r = Math.round(16 + (99 - 16) * k);
        const g = Math.round(185 + (102 - 185) * k);
        const b = Math.round(129 + (241 - 129) * k);
        return `rgb(${r}, ${g}, ${b})`;
      }
    },
  },
  nitrogen: {
    label: 'Nitrogen (N) Content',
    unit: 'mg/kg',
    min: 10,
    max: 90,
    optimalRange: [40, 70],
    icon: Flame,
    description: 'Available soil inorganic nitrogen reservoir for vegetative growth',
    samplePoints: [
      { x: 0.2, y: 0.25, val: 24 },
      { x: 0.4, y: 0.65, val: 62 },
      { x: 0.6, y: 0.3, val: 55 },
      { x: 0.85, y: 0.2, val: 18 },
      { x: 0.7, y: 0.75, val: 78 },
      { x: 0.3, y: 0.8, val: 32 },
    ],
    colorStop: (t: number) => {
      // Charcoal -> Golden Amber -> Emerald Leaf
      const r = Math.round(20 + t * 40 + (1 - t) * 180);
      const g = Math.round(40 + t * 170);
      const b = Math.round(30 + t * 70);
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
  phosphorus: {
    label: 'Phosphorus (P - Bray)',
    unit: 'ppm',
    min: 5,
    max: 50,
    optimalRange: [15, 30],
    icon: Gauge,
    description: 'Bray-extractable root-development phosphorus',
    samplePoints: [
      { x: 0.18, y: 0.22, val: 11 },
      { x: 0.45, y: 0.55, val: 22 },
      { x: 0.65, y: 0.25, val: 28 },
      { x: 0.82, y: 0.35, val: 9 },
      { x: 0.72, y: 0.85, val: 34 },
      { x: 0.22, y: 0.78, val: 14 },
    ],
    colorStop: (t: number) => {
      const r = Math.round(180 * (1 - t) + 16 * t);
      const g = Math.round(80 * (1 - t) + 185 * t);
      const b = Math.round(200 * t + 40 * (1 - t));
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
  potassium: {
    label: 'Potassium (K)',
    unit: 'cmol/kg',
    min: 0.1,
    max: 1.2,
    optimalRange: [0.35, 0.8],
    icon: Layers,
    description: 'Exchangeable potassium ensuring drought resilience and cell turgor',
    samplePoints: [
      { x: 0.25, y: 0.3, val: 0.22 },
      { x: 0.5, y: 0.6, val: 0.54 },
      { x: 0.7, y: 0.4, val: 0.68 },
      { x: 0.85, y: 0.15, val: 0.18 },
      { x: 0.78, y: 0.8, val: 0.85 },
      { x: 0.15, y: 0.85, val: 0.38 },
    ],
    colorStop: (t: number) => {
      const r = Math.round(140 * (1 - t) + 200 * t);
      const g = Math.round(60 * (1 - t) + 130 * t);
      const b = Math.round(220 * (1 - t) + 20 * t);
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
  moisture: {
    label: 'Volumetric Soil Moisture',
    unit: '% VWC',
    min: 5,
    max: 45,
    optimalRange: [22, 35],
    icon: Droplets,
    description: 'Preview estimate — not live NASA POWER assimilation',
    samplePoints: [
      { x: 0.2, y: 0.2, val: 14 },
      { x: 0.42, y: 0.5, val: 28 },
      { x: 0.6, y: 0.35, val: 32 },
      { x: 0.88, y: 0.28, val: 12 },
      { x: 0.76, y: 0.78, val: 37 },
      { x: 0.3, y: 0.82, val: 21 },
    ],
    colorStop: (t: number) => {
      // Dry Amber -> Cyan Aqua -> Deep Marine
      const r = Math.round(245 * (1 - t) + 6 * t);
      const g = Math.round(158 * (1 - t) + 182 * t);
      const b = Math.round(11 * (1 - t) + 212 * t);
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
  carbon: {
    label: 'Soil Organic Carbon (SOC)',
    unit: 'g/kg',
    min: 5,
    max: 40,
    optimalRange: [20, 35],
    icon: Gauge,
    description: 'Topsoil organic carbon index representing microbial fertility tier',
    samplePoints: [
      { x: 0.22, y: 0.25, val: 12 },
      { x: 0.45, y: 0.58, val: 26 },
      { x: 0.68, y: 0.38, val: 30 },
      { x: 0.82, y: 0.2, val: 9 },
      { x: 0.74, y: 0.82, val: 33 },
      { x: 0.28, y: 0.75, val: 19 },
    ],
    colorStop: (t: number) => {
      const r = Math.round(120 * (1 - t) + 16 * t);
      const g = Math.round(80 * (1 - t) + 185 * t);
      const b = Math.round(40 * (1 - t) + 129 * t);
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
};

export const SoilNutrientHeatmapCanvas: React.FC<SoilNutrientHeatmapCanvasProps> = ({
  initialLayer = 'ph',
  className = '',
  onProbeSelect,
  interactive = true,
}) => {
  const [activeLayer, setActiveLayer] = useState<SoilLayerType>(initialLayer);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [probe, setProbe] = useState<SoilProbeResult | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const config = LAYER_CONFIG[activeLayer];

  // Inverse Distance Weighting (IDW) interpolation
  const interpolate = useCallback(
    (xNorm: number, yNorm: number): number => {
      const points = config.samplePoints;
      let numerator = 0;
      let denominator = 0;
      const p = 2; // Power parameter

      for (const pt of points) {
        const dist = Math.hypot(pt.x - xNorm, pt.y - yNorm);
        if (dist < 0.001) return pt.val;
        const weight = 1 / Math.pow(dist, p);
        numerator += weight * pt.val;
        denominator += weight;
      }
      return denominator === 0 ? config.min : numerator / denominator;
    },
    [config]
  );

  const getAdvisory = useCallback(
    (value: number) => {
      const [optMin, optMax] = config.optimalRange;
      if (value >= optMin && value <= optMax) {
        return {
          status: 'optimal' as const,
          recommendation: 'Soil parameter in healthy target range for standard crop cycle.',
        };
      }
      if (value < optMin) {
        return {
          status: 'critical' as const,
          recommendation: `Deficit detected (${value.toFixed(1)} ${config.unit}). Recommend soil amendment or targeted micro-dosing.`,
        };
      }
      return {
        status: 'warning' as const,
        recommendation: `Elevated levels detected (${value.toFixed(1)} ${config.unit}). Avoid over-fertilization to prevent leaching.`,
      };
    },
    [config]
  );

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth || 400;
    const parentHeight = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = parentWidth * dpr;
    canvas.height = parentHeight * dpr;
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${parentHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, parentWidth, parentHeight);

    // Raster interpolation grid
    const step = 8; // Pixel step for smooth rendering
    const cols = Math.ceil(parentWidth / step);
    const rows = Math.ceil(parentHeight / step);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * step;
        const py = r * step;
        const xNorm = px / parentWidth;
        const yNorm = py / parentHeight;

        const val = interpolate(xNorm, yNorm);
        const normVal = Math.max(0, Math.min(1, (val - config.min) / (config.max - config.min)));

        ctx.fillStyle = config.colorStop(normVal);
        ctx.fillRect(px, py, step, step);
      }
    }

    // Overlay iso-contour lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      const radius = (parentWidth * 0.15) * i;
      ctx.arc(parentWidth * 0.5, parentHeight * 0.5, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Render sample telemetry sensors
    for (const pt of config.samplePoints) {
      const sx = pt.x * parentWidth;
      const sy = pt.y * parentHeight;

      // Outer ripple
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();

      // Core point
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Hover crosshair and probe marker
    if (hoverPos) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 0);
      ctx.lineTo(hoverPos.x, parentHeight);
      ctx.moveTo(0, hoverPos.y);
      ctx.lineTo(parentWidth, hoverPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Probe ring
      ctx.beginPath();
      ctx.arc(hoverPos.x, hoverPos.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [activeLayer, config, interpolate, hoverPos]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xNorm = Math.max(0, Math.min(1, x / rect.width));
    const yNorm = Math.max(0, Math.min(1, y / rect.height));

    const val = interpolate(xNorm, yNorm);
    const advisory = getAdvisory(val);

    const probeData: SoilProbeResult = {
      x: Math.round(x),
      y: Math.round(y),
      value: Number(val.toFixed(2)),
      unit: config.unit,
      label: config.label,
      status: advisory.status,
      recommendation: advisory.recommendation,
    };

    setHoverPos({ x, y });
    setProbe(probeData);
    if (onProbeSelect) onProbeSelect(probeData);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    setProbe(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Layer selector tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {(Object.keys(LAYER_CONFIG) as SoilLayerType[]).map(layerKey => {
            const cfg = LAYER_CONFIG[layerKey];
            const Icon = cfg.icon;
            const isSelected = activeLayer === layerKey;
            return (
              <button
                key={layerKey}
                onClick={() => {
                  setActiveLayer(layerKey);
                  setProbe(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cfg.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xxs font-mono text-gray-500 dark:text-gray-400">
          IDW Mesh Resolution: 8px
        </span>
      </div>

      {/* Main Canvas Frame */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950 shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-[280px] block cursor-crosshair"
        />

        {/* Live probe card tooltip overlay */}
        {probe && (
          <div className="absolute top-3 left-3 bg-gray-900/90 border border-white/10 backdrop-blur-md p-3 rounded-xl shadow-xl text-xs text-white max-w-xs pointer-events-none animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-semibold text-gray-200">{probe.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xxs font-bold uppercase ${
                  probe.status === 'optimal'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : probe.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {probe.status}
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {probe.value} <span className="text-xs text-gray-400 font-normal">{probe.unit}</span>
            </div>
            <p className="text-xxs text-gray-300 mt-1 leading-snug">{probe.recommendation}</p>
            <div className="mt-2 text-xxs font-mono text-gray-500">
              Field Grid: ({probe.x}px, {probe.y}px)
            </div>
          </div>
        )}

        {/* Legend strip at bottom */}
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 text-xxs font-mono text-gray-300 pointer-events-none">
          <span>
            {config.min} {config.unit}
          </span>
          <div className="w-16 h-2 rounded-full bg-gradient-to-r from-red-500 via-emerald-400 to-cyan-500 opacity-80" />
          <span>
            {config.max} {config.unit}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SoilNutrientHeatmapCanvas;
