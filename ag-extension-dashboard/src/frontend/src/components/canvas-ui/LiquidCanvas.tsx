import React, { useRef, useEffect } from 'react';

interface LiquidCanvasProps {
  className?: string;
  color?: string; // Primary hex color (default emerald #059669)
  secondaryColor?: string; // Secondary hex color (default teal #14b8a6)
  interactive?: boolean;
  opacity?: number;
}

interface FluidBlob {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

function initBlobs(width: number, height: number): FluidBlob[] {
  return Array.from({ length: 5 }, (_, i) => ({
    x: (width / 6) * (i + 1),
    y: height / 2 + Math.sin(i) * 50,
    radius: 100 + (i % 3) * 40,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.002 + Math.random() * 0.002,
  }));
}

function updateAndDrawBlob(
  ctx: CanvasRenderingContext2D,
  blob: FluidBlob,
  idx: number,
  width: number,
  height: number,
  pointer: { x: number; y: number; radius: number },
  color: string,
  secondaryColor: string
) {
  blob.phase += blob.speed;
  blob.x += blob.vx + Math.cos(blob.phase) * 0.5;
  blob.y += blob.vy + Math.sin(blob.phase) * 0.5;

  if (blob.x < -blob.radius) blob.x = width + blob.radius;
  if (blob.x > width + blob.radius) blob.x = -blob.radius;
  if (blob.y < -blob.radius) blob.y = height + blob.radius;
  if (blob.y > height + blob.radius) blob.y = -blob.radius;

  const dx = pointer.x - blob.x;
  const dy = pointer.y - blob.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < pointer.radius * 2) {
    const force = (1 - dist / (pointer.radius * 2)) * 1.5;
    blob.x += dx * force * 0.02;
    blob.y += dy * force * 0.02;
  }

  const blobGrad = ctx.createRadialGradient(
    blob.x,
    blob.y,
    blob.radius * 0.1,
    blob.x,
    blob.y,
    blob.radius
  );
  const useColor = idx % 2 === 0 ? color : secondaryColor;
  blobGrad.addColorStop(0, `${useColor}30`);
  blobGrad.addColorStop(0.6, `${useColor}15`);
  blobGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = blobGrad;
  ctx.beginPath();
  ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
  ctx.fill();
}

function attachEventListeners(
  canvas: HTMLCanvasElement,
  pointer: { targetX: number; targetY: number },
  interactive: boolean,
  onResize: () => void
): () => void {
  const handleMouseMove = (e: MouseEvent) => {
    if (!interactive) return;
    const rect = canvas.getBoundingClientRect();
    pointer.targetX = e.clientX - rect.left;
    pointer.targetY = e.clientY - rect.top;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!interactive || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    pointer.targetX = e.touches[0].clientX - rect.left;
    pointer.targetY = e.touches[0].clientY - rect.top;
  };

  window.addEventListener('resize', onResize);
  if (interactive) {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
  }

  return () => {
    window.removeEventListener('resize', onResize);
    if (interactive) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    }
  };
}

export const LiquidCanvas: React.FC<LiquidCanvasProps> = ({
  className = '',
  color = '#059669',
  secondaryColor = '#0d9488',
  interactive = true,
  opacity = 0.6,
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

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const pointer = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      radius: 120,
    };

    const blobs = initBlobs(width, height);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    const cleanupListeners = attachEventListeners(canvas, pointer, interactive, handleResize);

    const render = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        10,
        pointer.x,
        pointer.y,
        width * 0.7
      );
      gradient.addColorStop(0, `${color}25`);
      gradient.addColorStop(0.5, `${secondaryColor}10`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      blobs.forEach((blob, idx) => {
        updateAndDrawBlob(ctx, blob, idx, width, height, pointer, color, secondaryColor);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      cleanupListeners();
    };
  }, [color, secondaryColor, interactive]);

  return (
    <canvas
      ref={canvasRef}
      style={{ opacity }}
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
    />
  );
};

export default LiquidCanvas;
