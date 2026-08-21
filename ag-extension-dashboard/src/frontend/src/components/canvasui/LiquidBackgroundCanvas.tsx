import React, { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export const LiquidBackgroundCanvas: React.FC = () => {
  const { liquidEffect } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!liquidEffect) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Particle[] = [];
    const maxParticles = 60;
    const colors = [
      'rgba(16, 185, 129, ',  // Emerald
      'rgba(6, 182, 212, ',   // Cyan
      'rgba(52, 211, 153, ',  // Mint
      'rgba(20, 184, 166, ',  // Teal
    ];

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const addFluidSplat = (x: number, y: number, speedX = 0, speedY = 0) => {
      const count = Math.min(4, Math.floor(Math.abs(speedX) + Math.abs(speedY)) + 2);
      for (let i = 0; i < count; i++) {
        if (particles.length >= maxParticles) {
          particles.shift();
        }
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: speedX * 0.25 + (Math.random() - 0.5) * 1.5,
          vy: speedY * 0.25 + (Math.random() - 0.5) * 1.5,
          radius: Math.random() * 45 + 30,
          color,
          alpha: Math.random() * 0.35 + 0.25,
          decay: Math.random() * 0.008 + 0.005,
        });
      }
    };

    let lastX = 0;
    let lastY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      addFluidSplat(e.clientX, e.clientY, dx, dy);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        lastX = touch.clientX;
        lastY = touch.clientY;
        addFluidSplat(touch.clientX, touch.clientY, dx, dy);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Ambient floating orbs when idle
    let step = 0;
    const render = () => {
      step += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Ambient background fluid flow
      const ambient1X = width * 0.3 + Math.sin(step * 0.8) * (width * 0.15);
      const ambient1Y = height * 0.4 + Math.cos(step * 0.6) * (height * 0.12);
      const ambient2X = width * 0.7 + Math.cos(step * 0.7) * (width * 0.18);
      const ambient2Y = height * 0.6 + Math.sin(step * 0.9) * (height * 0.15);

      // Draw ambient glow 1
      const grad1 = ctx.createRadialGradient(ambient1X, ambient1Y, 10, ambient1X, ambient1Y, width * 0.35);
      grad1.addColorStop(0, 'rgba(16, 185, 129, 0.07)');
      grad1.addColorStop(0.5, 'rgba(6, 182, 212, 0.03)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Draw ambient glow 2
      const grad2 = ctx.createRadialGradient(ambient2X, ambient2Y, 10, ambient2X, ambient2Y, width * 0.4);
      grad2.addColorStop(0, 'rgba(5, 150, 105, 0.06)');
      grad2.addColorStop(0.6, 'rgba(13, 148, 136, 0.02)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Draw pointer fluid particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha -= p.decay;
        p.radius += 0.4;

        if (p.alpha <= 0.01) {
          particles.splice(i, 1);
          continue;
        }

        const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        pGrad.addColorStop(0, `${p.color}${p.alpha})`);
        pGrad.addColorStop(0.6, `${p.color}${p.alpha * 0.4})`);
        pGrad.addColorStop(1, `${p.color}0)`);

        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [liquidEffect]);

  if (!liquidEffect) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ease-in-out opacity-90"
      style={{ filter: 'blur(16px)' }}
    />
  );
};

export default LiquidBackgroundCanvas;
