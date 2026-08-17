import React, { useRef, useEffect } from 'react';

export interface LiveSparklineCanvasProps {
  data: number[];
  width?: number | string;
  height?: number;
  color?: string;
  fillColor?: string;
  lineWidth?: number;
  showDot?: boolean;
  className?: string;
}

export const LiveSparklineCanvas: React.FC<LiveSparklineCanvasProps> = ({
  data,
  width = '100%',
  height = 40,
  color = '#10b981',
  fillColor = 'rgba(16, 185, 129, 0.15)',
  lineWidth = 2,
  showDot = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const parentWidth = canvas.parentElement?.clientWidth || (typeof width === 'number' ? width : 120);
    const canvasHeight = height;

    canvas.width = parentWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, parentWidth, canvasHeight);

    if (!data || data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min === 0 ? 1 : max - min;
    const padding = 4;
    const drawHeight = canvasHeight - padding * 2;
    const drawWidth = parentWidth - padding * 2;

    const points = data.map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * drawWidth;
      const y = padding + drawHeight - ((val - min) / range) * drawHeight;
      return { x, y };
    });

    // Draw filled area under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      const cy = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
    }
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(lastPoint.x, canvasHeight);
    ctx.lineTo(points[0].x, canvasHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw smooth line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      const cy = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
    }
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw glowing endpoint dot
    if (showDot && points.length > 0) {
      const last = points[points.length - 1];
      // Outer glow
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1.0;
      ctx.fill();
    }
  }, [data, width, height, color, fillColor, lineWidth, showDot]);

  return (
    <div className={`relative inline-block w-full overflow-hidden ${className}`} style={{ height }}>
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
};

export default LiveSparklineCanvas;
