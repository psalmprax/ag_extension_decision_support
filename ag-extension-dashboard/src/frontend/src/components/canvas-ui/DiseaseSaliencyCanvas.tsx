import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eye, ZoomIn, Sliders, AlertCircle } from 'lucide-react';

export interface LesionDetectionZone {
  id: string;
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  radius: number; // Normalized 0..1
  label: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface DiseaseSaliencyCanvasProps {
  imageSrc?: string;
  detections?: LesionDetectionZone[];
  className?: string;
  onSelectZone?: (zone: LesionDetectionZone) => void;
}

function drawProceduralLeaf(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#064e3b');
  bgGrad.addColorStop(0.5, '#047857');
  bgGrad.addColorStop(1, '#065f46');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.85);
  ctx.quadraticCurveTo(width * 0.45, height * 0.5, width * 0.9, height * 0.15);
  ctx.stroke();

  ctx.lineWidth = 1;
  for (let i = 1; i <= 6; i++) {
    const vx = width * (0.15 + i * 0.11);
    const vy = height * (0.75 - i * 0.09);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + 45, vy - 35);
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx - 40, vy - 25);
    ctx.stroke();
  }
}

function drawHeatmapZone(
  ctx: CanvasRenderingContext2D,
  det: LesionDetectionZone,
  width: number,
  height: number,
  opacity: number
) {
  const cx = det.x * width;
  const cy = det.y * height;
  const rad = det.radius * Math.min(width, height);

  const radialGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  if (det.severity === 'severe') {
    radialGrad.addColorStop(0, `rgba(239, 68, 68, ${opacity})`);
    radialGrad.addColorStop(0.5, `rgba(245, 158, 11, ${opacity * 0.7})`);
    radialGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  } else if (det.severity === 'moderate') {
    radialGrad.addColorStop(0, `rgba(245, 158, 11, ${opacity})`);
    radialGrad.addColorStop(0.6, `rgba(234, 179, 8, ${opacity * 0.6})`);
    radialGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  } else {
    radialGrad.addColorStop(0, `rgba(16, 185, 129, ${opacity})`);
    radialGrad.addColorStop(0.7, `rgba(59, 130, 246, ${opacity * 0.5})`);
    radialGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
  }

  ctx.fillStyle = radialGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle =
    det.severity === 'severe' ? '#ef4444' : det.severity === 'moderate' ? '#f59e0b' : '#10b981';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLoupeLens(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  mousePos: { x: number; y: number },
  width: number,
  height: number
) {
  const loupeRadius = 52;
  const zoomFactor = 2.2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, loupeRadius, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#064e3b';
  ctx.fillRect(mousePos.x - loupeRadius, mousePos.y - loupeRadius, loupeRadius * 2, loupeRadius * 2);

  if (img) {
    ctx.drawImage(
      img,
      mousePos.x - (mousePos.x / width) * (width / zoomFactor),
      mousePos.y - (mousePos.y / height) * (height / zoomFactor),
      width / zoomFactor,
      height / zoomFactor,
      mousePos.x - loupeRadius,
      mousePos.y - loupeRadius,
      loupeRadius * 2,
      loupeRadius * 2
    );
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let gx = -loupeRadius; gx <= loupeRadius; gx += 12) {
      for (let gy = -loupeRadius; gy <= loupeRadius; gy += 12) {
        ctx.strokeRect(mousePos.x + gx, mousePos.y + gy, 10, 10);
      }
    }
  }

  const sheen = ctx.createLinearGradient(
    mousePos.x - loupeRadius,
    mousePos.y - loupeRadius,
    mousePos.x + loupeRadius,
    mousePos.y + loupeRadius
  );
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
  ctx.fillStyle = sheen;
  ctx.fillRect(mousePos.x - loupeRadius, mousePos.y - loupeRadius, loupeRadius * 2, loupeRadius * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, loupeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
}

export const DiseaseSaliencyCanvas: React.FC<DiseaseSaliencyCanvasProps> = ({
  imageSrc,
  detections = [],
  className = '',
  onSelectZone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLoupe, setShowLoupe] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.65);
  const [selectedZone, setSelectedZone] = useState<LesionDetectionZone | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      img.onload = () => {
        imgRef.current = img;
      };
      img.onerror = () => {
        imgRef.current = null;
      };
    } else {
      imgRef.current = null;
    }
  }, [imageSrc]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth || 500;
    const parentHeight = 320;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = parentWidth * dpr;
    canvas.height = parentHeight * dpr;
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${parentHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, parentWidth, parentHeight);

    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, parentWidth, parentHeight);
    } else {
      drawProceduralLeaf(ctx, parentWidth, parentHeight);
    }

    if (showHeatmap) {
      for (const det of detections) {
        drawHeatmapZone(ctx, det, parentWidth, parentHeight, heatmapOpacity);
      }
    }

    if (showLoupe && mousePos) {
      drawLoupeLens(ctx, imgRef.current, mousePos, parentWidth, parentHeight);
    }
  }, [detections, showHeatmap, showLoupe, heatmapOpacity, mousePos]);

  useEffect(() => {
    render();
  }, [render]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const xNorm = x / rect.width;
    const yNorm = y / rect.height;
    const hit = detections.find(
      d => Math.hypot(d.x - xNorm, d.y - yNorm) <= d.radius
    );
    if (hit) {
      setSelectedZone(hit);
      if (onSelectZone) onSelectZone(hit);
    }
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  const hasLiveDetections = detections.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {!hasLiveDetections && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No live leaf-inference detections are available yet. Upload or select an
            analyzed sample to see lesion highlighting here — this canvas does not manufacture scan results.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showHeatmap
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Thermal Saliency</span>
          </button>

          <button
            onClick={() => setShowLoupe(!showLoupe)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showLoupe
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>2.5x Loupe Lens</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-xxs uppercase tracking-wider">Heatmap Alpha:</span>
          <input
            type="range"
            min={0.2}
            max={1.0}
            step={0.05}
            value={heatmapOpacity}
            onChange={e => setHeatmapOpacity(Number(e.target.value))}
            className="w-20 accent-emerald-500"
          />
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950 shadow-lg">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-[320px] block cursor-none"
        />

        {selectedZone && (
          <div className="absolute top-3 right-3 bg-gray-900/90 border border-white/10 backdrop-blur-md p-3 rounded-xl shadow-xl text-xs text-white max-w-xs animate-in fade-in">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
              <AlertCircle className="w-4 h-4" />
              <span>{selectedZone.label}</span>
            </div>
            <div className="flex items-center justify-between text-xxs font-mono text-gray-300">
              <span>Confidence: {(selectedZone.confidence * 100).toFixed(1)}%</span>
              <span className="uppercase text-amber-400 font-bold">{selectedZone.severity}</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/10 text-xxs font-mono text-gray-400">
          Edge AI Saliency Engine • Move cursor to inspect
        </div>
      </div>
    </div>
  );
};

export default DiseaseSaliencyCanvas;
