import React, { useRef, useEffect } from 'react';

interface TelemetryRadarCanvasProps {
  className?: string;
  particleCount?: number;
  sweepSpeed?: number;
  accentColor?: string; // Emerald default #10b981
  radarColor?: string; // Cyan default #06b6d4
}

interface TelemetryNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulse: number;
}

function drawRangeRings(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  maxRadius: number,
  radarColor: string
) {
  [0.25, 0.5, 0.75, 1.0].forEach(rRatio => {
    ctx.beginPath();
    ctx.strokeStyle = `${radarColor}15`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.arc(centerX, centerY, maxRadius * rRatio * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function updateAndDrawTelemetryNodes(
  ctx: CanvasRenderingContext2D,
  nodes: TelemetryNode[],
  width: number,
  height: number,
  accentColor: string
) {
  nodes.forEach((node, i) => {
    node.x += node.vx;
    node.y += node.vy;

    if (node.x < 0 || node.x > width) node.vx *= -1;
    if (node.y < 0 || node.y > height) node.vy *= -1;

    node.pulse += 0.05;
    const currentAlpha = node.alpha + Math.sin(node.pulse) * 0.2;

    ctx.beginPath();
    ctx.fillStyle = `${accentColor}${Math.floor(Math.max(0.1, currentAlpha) * 255)
      .toString(16)
      .padStart(2, '0')}`;
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();

    for (let j = i + 1; j < nodes.length; j++) {
      const other = nodes[j];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 70) {
        ctx.beginPath();
        ctx.strokeStyle = `${accentColor}${Math.floor((1 - dist / 70) * 40)
          .toString(16)
          .padStart(2, '0')}`;
        ctx.lineWidth = 0.75;
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }
  });
}

export const TelemetryRadarCanvas: React.FC<TelemetryRadarCanvasProps> = ({
  className = '',
  particleCount = 35,
  sweepSpeed = 0.02,
  accentColor = '#10b981',
  radarColor = '#06b6d4',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 200);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const nodes: TelemetryNode[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }));

    let radarAngle = 0;

    const render = () => {
      radarAngle += sweepSpeed;
      if (radarAngle > Math.PI * 2) radarAngle = 0;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

      const sweepGradient = ctx.createConicGradient(radarAngle, centerX, centerY);
      sweepGradient.addColorStop(0, `${radarColor}30`);
      sweepGradient.addColorStop(0.1, `${radarColor}05`);
      sweepGradient.addColorStop(0.2, 'transparent');
      sweepGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = sweepGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
      ctx.fill();

      drawRangeRings(ctx, centerX, centerY, maxRadius, radarColor);
      updateAndDrawTelemetryNodes(ctx, nodes, width, height, accentColor);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [particleCount, sweepSpeed, accentColor, radarColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
};

export default TelemetryRadarCanvas;
