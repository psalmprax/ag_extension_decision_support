import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

export interface ScrollSequenceCanvasProps {
  /** Total number of frames in the sequence */
  frameCount: number;
  /** Function returning image source URL given a 0-indexed frame number */
  getFrameUrl: (index: number) => string;
  /** Optional container ref to bind scroll progress to (defaults to window) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Optional custom progress value (0.0 to 1.0) when not using scroll */
  manualProgress?: number;
  /** Fit mode: cover (fill viewport) or contain (maintain full aspect ratio) */
  fit?: 'cover' | 'contain';
  /** Background fill color behind canvas */
  backgroundColor?: string;
  /** Callback reporting preloading progress (0 to 100) */
  onLoadProgress?: (percent: number) => void;
  className?: string;
}

/**
 * Reusable Canvas Image Sequence Scrubber
 * Inspired by Apple / Awwwards / DVxUI scroll animation technique.
 * Preloads frames and draws the matching frame to an HTML5 canvas at 60fps.
 */
export function ScrollSequenceCanvas({
  frameCount,
  getFrameUrl,
  containerRef,
  manualProgress,
  fit = 'cover',
  backgroundColor = '#0b0f19',
  onLoadProgress,
  className = '',
}: ScrollSequenceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);
  const currentFrameRef = useRef(0);

  // Hook into Framer Motion scroll
  const { scrollYProgress } = useScroll(
    containerRef ? { target: containerRef as React.RefObject<HTMLElement>, offset: ['start start', 'end end'] } : {}
  );

  // Preload all frames into memory
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];
    imagesRef.current = images;

    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      img.onload = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / frameCount) * 100);
        setLoadPercent(pct);
        onLoadProgress?.(pct);
        if (loadedCount === frameCount) {
          setIsLoaded(true);
          renderFrame(currentFrameRef.current);
        } else if (loadedCount === 1) {
          renderFrame(0);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === frameCount) setIsLoaded(true);
      };
      images.push(img);
    }

    return () => {
      imagesRef.current = [];
    };
  }, [frameCount, getFrameUrl, onLoadProgress]);

  // Render a specific frame index to canvas
  const renderFrame = useCallback(
    (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.fillRect !== 'function' || typeof ctx.drawImage !== 'function') return;

      const img = imagesRef.current[index];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = width / height;

      if (fit === 'cover') {
        if (canvasRatio > imgRatio) {
          drawWidth = width;
          drawHeight = width / imgRatio;
          offsetY = (height - drawHeight) / 2;
        } else {
          drawHeight = height;
          drawWidth = height * imgRatio;
          offsetX = (width - drawWidth) / 2;
        }
      } else {
        if (canvasRatio > imgRatio) {
          drawHeight = height;
          drawWidth = height * imgRatio;
          offsetX = (width - drawWidth) / 2;
        } else {
          drawWidth = width;
          drawHeight = width / imgRatio;
          offsetY = (height - drawHeight) / 2;
        }
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    },
    [fit, backgroundColor]
  );

  // Resize canvas for device pixel ratio
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 600) * dpr;
    canvas.height = (rect.height || 400) * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.scale === 'function') {
      ctx.scale(dpr, dpr);
    }
    renderFrame(currentFrameRef.current);
  }, [renderFrame]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Update on manual progress if provided
  useEffect(() => {
    if (manualProgress !== undefined) {
      const frame = Math.max(0, Math.min(frameCount - 1, Math.floor(manualProgress * (frameCount - 1))));
      currentFrameRef.current = frame;
      requestAnimationFrame(() => renderFrame(frame));
    }
  }, [manualProgress, frameCount, renderFrame]);

  // Sync scroll progress to frame index
  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (manualProgress === undefined) {
      const frame = Math.max(0, Math.min(frameCount - 1, Math.floor(latest * (frameCount - 1))));
      currentFrameRef.current = frame;
      requestAnimationFrame(() => renderFrame(frame));
    }
  });

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10">
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-150"
              style={{ width: `${loadPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono tracking-wider text-emerald-400/80">
            BUFFERING FRAMES {loadPercent}%
          </span>
        </div>
      )}
    </div>
  );
}
