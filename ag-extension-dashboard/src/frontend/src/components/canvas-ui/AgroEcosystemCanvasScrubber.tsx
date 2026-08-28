import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sparkles, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { playStageChime, playScrubTick, isAudioEnabled, setAudioMuted } from '@/lib/audioHaptics';
import { AGRO_STAGES, type AgroStageMeta } from './agroStages';

export { AGRO_STAGES, type AgroStageMeta };

export interface AgroEcosystemCanvasScrubberProps {
  /** Scroll or manual progress value (0.0 to 1.0) */
  progress?: number;
  /** Callback when stage changes (0: Satellite, 1: Topo/NDVI, 2: SoilGrids, 3: AI Uplink) */
  onStageChange?: (stage: number) => void;
  /** Whether to show interactive scrubbing HUD overlay controls */
  showControls?: boolean;
  /** Optional interactive mode (internal animation loop if no scroll provided) */
  interactive?: boolean;
  className?: string;
}

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  p: number;
  time: number;
  mousePos: { x: number; y: number; rawX: number; rawY: number };
}

function renderBackground(rc: RenderContext) {
  const { ctx, width, height, mousePos } = rc;
  if (typeof ctx.createRadialGradient === 'function') {
    const bgGrad = ctx.createRadialGradient(
      width * 0.5 + mousePos.x * 30,
      height * 0.5 + mousePos.y * 30,
      10,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.8
    );
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#090d16');
    bgGrad.addColorStop(1, '#030712');
    ctx.fillStyle = bgGrad;
  } else {
    ctx.fillStyle = '#030712';
  }
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function renderStage1Orbit(rc: RenderContext) {
  const { ctx, width, height, p, time, mousePos } = rc;
  const weight = Math.max(0, 1 - Math.abs(p - 0.12) / 0.2);
  if (weight <= 0.01 || typeof ctx.save !== 'function') return;

  ctx.save();
  ctx.globalAlpha = weight;

  const centerX = width * 0.5 + mousePos.x * 20;
  const centerY = height * 0.85 + mousePos.y * 20;
  const globeRadius = Math.min(width, height) * 0.65;

  if (typeof ctx.createRadialGradient === 'function') {
    const globeGrad = ctx.createRadialGradient(
      centerX,
      centerY - globeRadius * 0.2,
      globeRadius * 0.1,
      centerX,
      centerY,
      globeRadius
    );
    globeGrad.addColorStop(0, 'rgba(14, 165, 233, 0.25)');
    globeGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.12)');
    globeGrad.addColorStop(1, 'rgba(3, 7, 18, 0.95)');
    ctx.fillStyle = globeGrad;
  } else {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius, Math.PI, 0);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius, Math.PI, 0);
  ctx.stroke();

  if (typeof ctx.ellipse === 'function') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - globeRadius * 0.5, globeRadius * 1.1, globeRadius * 0.35, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
  }

  const satAngle = Math.PI * (0.8 + (p / 0.3) * 0.5) + time * 0.2;
  const satX = centerX + Math.cos(satAngle) * (globeRadius * 1.1);
  const satY = centerY - globeRadius * 0.5 + Math.sin(satAngle) * (globeRadius * 0.35);

  const targetX = centerX - 40;
  const targetY = centerY - globeRadius * 0.9;

  if (typeof ctx.createLinearGradient === 'function') {
    const coneGrad = ctx.createLinearGradient(satX, satY, targetX, targetY);
    coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
    coneGrad.addColorStop(1, 'rgba(52, 211, 153, 0.05)');
    ctx.fillStyle = coneGrad;
  } else {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  }

  ctx.beginPath();
  ctx.moveTo(satX, satY);
  ctx.lineTo(targetX - 50, targetY + 10);
  ctx.lineTo(targetX + 50, targetY + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(satX, satY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(satX - 16, satY - 2, 10, 4);
  ctx.fillRect(satX + 6, satY - 2, 10, 4);

  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 16 + Math.sin(time * 6) * 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '11px monospace';
  ctx.fillText(`NASA POWER // RAD: ${(18.4 + Math.sin(time) * 1.2).toFixed(1)} MJ/m²`, targetX + 25, targetY - 10);
  ctx.fillText(`GPM PRECIP // ${(4.2 + Math.cos(time) * 0.8).toFixed(1)} mm/day`, targetX + 25, targetY + 8);

  ctx.restore();
}

function drawTopoMesh(ctx: CanvasRenderingContext2D, originX: number, originY: number, tileW: number, tileH: number, time: number) {
  const gridRows = 14;
  const gridCols = 22;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const isoX = originX + (c - r) * tileW * 0.6;
      const noise = Math.sin(c * 0.4 + time * 0.5) * Math.cos(r * 0.5) * 22;
      const isoY = originY + (c + r) * tileH * 0.5 - noise;

      const ndviVal = (Math.sin(c * 0.3 + r * 0.2) + 1) * 0.5;
      let nodeColor = 'rgba(52, 211, 153, 0.4)';
      if (ndviVal > 0.7) nodeColor = 'rgba(16, 185, 129, 0.8)';
      else if (ndviVal < 0.3) nodeColor = 'rgba(251, 191, 36, 0.6)';

      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(isoX, isoY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      if (c < gridCols - 1) {
        const nextNoise = Math.sin((c + 1) * 0.4 + time * 0.5) * Math.cos(r * 0.5) * 22;
        const nextX = originX + (c + 1 - r) * tileW * 0.6;
        const nextY = originY + (c + 1 + r) * tileH * 0.5 - nextNoise;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.15)';
        ctx.beginPath();
        ctx.moveTo(isoX, isoY);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();
      }

      if (r < gridRows - 1) {
        const nextNoise = Math.sin(c * 0.4 + time * 0.5) * Math.cos((r + 1) * 0.5) * 22;
        const nextX = originX + (c - (r + 1)) * tileW * 0.6;
        const nextY = originY + (c + (r + 1)) * tileH * 0.5 - nextNoise;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.1)';
        ctx.beginPath();
        ctx.moveTo(isoX, isoY);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();
      }
    }
  }
}

function drawTopoPins(ctx: CanvasRenderingContext2D, originX: number, originY: number, tileW: number, tileH: number, time: number) {
  const pinLocations = [
    { c: 6, r: 4, name: 'Plot #104 (Maize)', ndvi: '0.78 (Healthy)' },
    { c: 14, r: 8, name: 'Plot #105 (Cassava)', ndvi: '0.42 (Stressed)' },
    { c: 10, r: 11, name: 'Plot #106 (Sorghum)', ndvi: '0.84 (Optimal)' },
  ];

  pinLocations.forEach((pin, idx) => {
    const px = originX + (pin.c - pin.r) * tileW * 0.6;
    const pNoise = Math.sin(pin.c * 0.4 + time * 0.5) * Math.cos(pin.r * 0.5) * 22;
    const py = originY + (pin.c + pin.r) * tileH * 0.5 - pNoise;

    ctx.strokeStyle = idx === 1 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(52, 211, 153, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py - 15, 8 + Math.sin(time * 5 + idx) * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 15);
    ctx.stroke();

    ctx.fillStyle = idx === 1 ? '#fbbf24' : '#34d399';
    ctx.beginPath();
    ctx.arc(px, py - 15, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.fillRect(px + 12, py - 28, 140, 32);
    ctx.strokeRect(px + 12, py - 28, 140, 32);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(pin.name, px + 18, py - 16);
    ctx.fillStyle = idx === 1 ? '#fbbf24' : '#34d399';
    ctx.font = '9px monospace';
    ctx.fillText(`NDVI: ${pin.ndvi}`, px + 18, py - 4);
  });
}

function renderStage2Topo(rc: RenderContext) {
  const { ctx, width, height, p, time, mousePos } = rc;
  const weight = Math.max(0, 1 - Math.abs(p - 0.42) / 0.2);
  if (weight <= 0.01 || typeof ctx.save !== 'function') return;

  ctx.save();
  ctx.globalAlpha = weight;

  const originX = width * 0.5 + mousePos.x * 25;
  const originY = height * 0.4 + mousePos.y * 20;
  const tileW = Math.min(width, 900) / 20;
  const tileH = tileW * 0.55;

  drawTopoMesh(ctx, originX, originY, tileW, tileH, time);
  drawTopoPins(ctx, originX, originY, tileW, tileH, time);

  ctx.restore();
}

function drawSoilHorizons(ctx: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, boxH: number, l1H: number, l2H: number) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  if (typeof ctx.createLinearGradient === 'function') {
    const l1Grad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + l1H);
    l1Grad.addColorStop(0, 'rgba(67, 56, 202, 0.2)');
    l1Grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
    ctx.fillStyle = l1Grad;
  } else {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  }
  ctx.fillRect(boxX, boxY, boxW, l1H);

  const l2Y = boxY + l1H;
  if (typeof ctx.createLinearGradient === 'function') {
    const l2Grad = ctx.createLinearGradient(boxX, l2Y, boxX, l2Y + l2H);
    l2Grad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    l2Grad.addColorStop(1, 'rgba(217, 119, 6, 0.15)');
    ctx.fillStyle = l2Grad;
  } else {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
  }
  ctx.fillRect(boxX, l2Y, boxW, l2H);

  const l3Y = l2Y + l2H;
  const l3H = boxH - l1H - l2H;
  ctx.fillStyle = 'rgba(75, 85, 99, 0.25)';
  ctx.fillRect(boxX, l3Y, boxW, l3H);
}

function drawPlantRoots(ctx: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, l1H: number, l2H: number, time: number) {
  const plantCount = 4;
  for (let i = 0; i < plantCount; i++) {
    const rootOriginX = boxX + (boxW / (plantCount + 1)) * (i + 1);
    const rootOriginY = boxY;

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rootOriginX, rootOriginY);
    ctx.lineTo(rootOriginX, rootOriginY - 24);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.beginPath();
    ctx.moveTo(rootOriginX, rootOriginY);
    if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.quadraticCurveTo(
        rootOriginX + Math.sin(time + i) * 15,
        rootOriginY + l1H + 20,
        rootOriginX + (i % 2 === 0 ? 25 : -25),
        rootOriginY + l1H + l2H * 0.7
      );
    } else {
      ctx.lineTo(rootOriginX, rootOriginY + l1H + l2H * 0.7);
    }
    ctx.stroke();

    for (let branch = 0; branch < 3; branch++) {
      const bY = rootOriginY + 20 + branch * 25;
      ctx.beginPath();
      ctx.moveTo(rootOriginX, bY);
      ctx.lineTo(rootOriginX + (branch % 2 === 0 ? 30 : -30), bY + 18);
      ctx.stroke();
    }
  }
}

function drawSoilMetrics(ctx: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, l2Y: number, l3Y: number) {
  const metrics = [
    { label: 'HORIZON A (0-20cm): Humus & NPK Organic Matter', val: '84%', color: '#34d399', y: boxY + 22 },
    { label: 'HORIZON B (20-60cm): Clay Density 380 g/kg // pH 6.2', val: '68%', color: '#fbbf24', y: l2Y + 24 },
    { label: 'HORIZON C (60-100cm): Moisture Percolation Zone', val: '45%', color: '#38bdf8', y: l3Y + 20 },
  ];

  metrics.forEach((m) => {
    ctx.fillStyle = m.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(m.label, boxX + 20, m.y);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(boxX + boxW - 140, m.y - 10, 110, 8);
    ctx.fillStyle = m.color;
    ctx.fillRect(boxX + boxW - 140, m.y - 10, 110 * (parseInt(m.val, 10) / 100), 8);
  });
}

function renderStage3Soil(rc: RenderContext) {
  const { ctx, width, height, p, time, mousePos } = rc;
  const weight = Math.max(0, 1 - Math.abs(p - 0.68) / 0.2);
  if (weight <= 0.01 || typeof ctx.save !== 'function') return;

  ctx.save();
  ctx.globalAlpha = weight;

  const boxX = width * 0.12;
  const boxW = width * 0.76;
  const boxY = height * 0.25 + mousePos.y * 15;
  const boxH = height * 0.55;
  const l1H = boxH * 0.28;
  const l2H = boxH * 0.42;
  const l2Y = boxY + l1H;
  const l3Y = l2Y + l2H;

  drawSoilHorizons(ctx, boxX, boxY, boxW, boxH, l1H, l2H);
  drawPlantRoots(ctx, boxX, boxY, boxW, l1H, l2H, time);
  drawSoilMetrics(ctx, boxX, boxY, boxW, l2Y, l3Y);

  const probeFraction = Math.max(0, Math.min(1, (mousePos.rawY - boxY) / boxH));
  const depthCm = Math.round(probeFraction * 100);
  const probeLaserY = boxY + probeFraction * boxH;

  if (probeFraction > 0 && probeFraction < 1) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1.5;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(boxX, probeLaserY);
    ctx.lineTo(boxX + boxW, probeLaserY);
    ctx.stroke();
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(14, 165, 233, 0.95)';
    ctx.fillRect(boxX + boxW - 110, probeLaserY - 12, 105, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`DEPTH: ${depthCm} cm`, boxX + boxW - 100, probeLaserY + 4);
  }

  ctx.restore();
}

function renderStage4EdgeUplink(rc: RenderContext) {
  const { ctx, width, height, p, time, mousePos } = rc;
  const weight = Math.max(0, 1 - Math.abs(p - 0.9) / 0.18);
  if (weight <= 0.01 || typeof ctx.save !== 'function') return;

  ctx.save();
  ctx.globalAlpha = weight;

  const nexusX = width * 0.35 + mousePos.x * 15;
  const nexusY = height * 0.5 + mousePos.y * 15;

  const hexRadius = 45;
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + time * 0.4;
    const hx = nexusX + Math.cos(angle) * hexRadius;
    const hy = nexusY + Math.sin(angle) * hexRadius;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();

  if (typeof ctx.createRadialGradient === 'function') {
    const coreGrad = ctx.createRadialGradient(nexusX, nexusY, 5, nexusX, nexusY, hexRadius);
    coreGrad.addColorStop(0, 'rgba(168, 85, 247, 0.9)');
    coreGrad.addColorStop(0.6, 'rgba(192, 132, 252, 0.3)');
    coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = coreGrad;
  } else {
    ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
  }
  ctx.fill();

  const nodeCount = 6;
  for (let i = 0; i < nodeCount; i++) {
    const angle = (Math.PI * 2 * i) / nodeCount + time * 0.2;
    const nx = nexusX + Math.cos(angle) * 110;
    const ny = nexusY + Math.sin(angle) * 75;

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(nexusX, nexusY);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const phoneX = width * 0.72 + mousePos.x * 10;
  const phoneY = height * 0.5 + mousePos.y * 10;

  if (typeof ctx.createLinearGradient === 'function') {
    const beamGrad = ctx.createLinearGradient(nexusX, nexusY, phoneX, phoneY);
    beamGrad.addColorStop(0, '#c084fc');
    beamGrad.addColorStop(0.5, '#34d399');
    beamGrad.addColorStop(1, '#38bdf8');
    ctx.strokeStyle = beamGrad;
  } else {
    ctx.strokeStyle = '#34d399';
  }

  ctx.lineWidth = 2;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -time * 30;
  }
  ctx.beginPath();
  ctx.moveTo(nexusX, nexusY);
  ctx.lineTo(phoneX, phoneY);
  ctx.stroke();
  if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 1.5;
  for (let wave = 1; wave <= 3; wave++) {
    const waveR = 25 + wave * 18 + ((time * 20) % 20);
    ctx.beginPath();
    ctx.arc(phoneX, phoneY, waveR, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 2;
  ctx.fillRect(phoneX - 35, phoneY - 60, 70, 120);
  ctx.strokeRect(phoneX - 35, phoneY - 60, 70, 120);

  ctx.fillStyle = '#065f46';
  ctx.fillRect(phoneX - 28, phoneY - 45, 56, 40);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('AI ADVISORY', phoneX - 24, phoneY - 33);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '7px sans-serif';
  ctx.fillText('Apply 2.5t Lime', phoneX - 24, phoneY - 21);
  ctx.fillText('Before Rain: 48h', phoneX - 24, phoneY - 11);

  ctx.restore();
}

export function AgroEcosystemCanvasScrubber({
  progress: externalProgress,
  onStageChange,
  showControls = true,
  interactive = false,
  className = '',
}: AgroEcosystemCanvasScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [internalProgress, setInternalProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioMuted, setLocalAudioMuted] = useState(!isAudioEnabled());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, rawX: 0, rawY: 0 });
  const prevStageRef = useRef<number>(-1);

  const activeProgress = externalProgress !== undefined ? externalProgress : internalProgress;
  const currentStage = Math.min(3, Math.floor(activeProgress * 4));

  useEffect(() => {
    onStageChange?.(currentStage);
    if (prevStageRef.current !== -1 && prevStageRef.current !== currentStage) {
      playStageChime(currentStage);
    }
    prevStageRef.current = currentStage;
  }, [currentStage, onStageChange]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        const next = prev + 0.003;
        return next > 1 ? 0 : next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = (rawX / rect.width - 0.5) * 2;
    const y = (rawY / rect.height - 0.5) * 2;
    setMousePos({ x, y, rawX, rawY });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0, rawX: 0, rawY: 0 });
  };

  const toggleAudio = () => {
    const nextMuted = !audioMuted;
    setLocalAudioMuted(nextMuted);
    setAudioMuted(nextMuted);
    if (!nextMuted) playStageChime(currentStage);
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function') return;

    const width = canvas.width;
    const height = canvas.height;
    if (!width || !height) return;
    const p = Math.max(0, Math.min(1, activeProgress));
    const time = performance.now() * 0.001;

    ctx.clearRect(0, 0, width, height);

    const rc: RenderContext = { ctx, width, height, p, time, mousePos };
    renderBackground(rc);
    renderStage1Orbit(rc);
    renderStage2Topo(rc);
    renderStage3Soil(rc);
    renderStage4EdgeUplink(rc);
  }, [activeProgress, mousePos]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const targetW = (rect.width || 600) * dpr;
      const targetH = (rect.height || 400) * dpr;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx && typeof ctx.scale === 'function') {
        ctx.scale(dpr, dpr);
      }
      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  const activeStageMeta = AGRO_STAGES[currentStage];
  const IconComponent = activeStageMeta.icon;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full min-h-[240px] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl bg-slate-950 ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-white/10 px-3.5 py-2 rounded-xl">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
            style={{ backgroundColor: `${activeStageMeta.color}20`, color: activeStageMeta.color }}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-semibold tracking-widest text-white/50">
              {activeStageMeta.badge}
            </div>
            <div className="text-xs font-bold text-white tracking-tight">{activeStageMeta.title}</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl font-mono text-[11px] text-emerald-400">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>{(activeProgress * 100).toFixed(0)}% SYNCHRONIZED</span>
        </div>
      </div>

      {showControls && (
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-xl flex flex-col gap-2 shadow-xl">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span className="font-mono text-[11px] text-emerald-400 font-semibold">
              SCROLL // SCRUB TIMELINE
            </span>
            <div className="flex items-center gap-2">
              {interactive && (
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause simulation' : 'Auto play simulation'}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-medium transition-colors"
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
                </button>
              )}
              {interactive && (
                <button
                  type="button"
                  aria-label="Reset simulation to start"
                  onClick={() => {
                    setInternalProgress(0);
                    playScrubTick();
                  }}
                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-white/60 hover:text-white transition-colors"
                  title="Reset to 0%"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                aria-label={audioMuted ? 'Unmute procedural audio' : 'Mute procedural audio'}
                onClick={toggleAudio}
                className={`p-1 rounded-md transition-colors ${
                  audioMuted
                    ? 'bg-slate-800 text-white/40 hover:text-white'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
                title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {audioMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            aria-label="Agronomic timeline progress"
            value={activeProgress}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setInternalProgress(val);
              playScrubTick();
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {AGRO_STAGES.map((s) => {
              const isActive = currentStage === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Jump to ${s.badge}`}
                  onClick={() => {
                    setInternalProgress(s.id * 0.28 + 0.05);
                    playStageChime(s.id);
                  }}
                  className={`text-[10px] font-mono py-1 px-1.5 rounded-lg border transition-all text-center truncate ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold shadow-sm shadow-emerald-950'
                      : 'bg-slate-800/40 border-white/[0.06] text-white/40 hover:text-white/80 hover:bg-slate-800'
                  }`}
                >
                  {s.badge.split('// ')[1]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
