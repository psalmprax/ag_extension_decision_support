import React from 'react';
import { cn } from '@/lib/cn';
import type { SceneStatus } from './useThreeScene';

interface ThreeViewportProps {
  containerRef: React.RefObject<HTMLDivElement>;
  status: SceneStatus;
  /** Describes what the view shows, for screen readers. */
  label: string;
  /** Shown instead of the 3D view when the device has no WebGL or the scene failed. */
  fallback: React.ReactNode;
  loadingText: string;
  className?: string;
  children?: React.ReactNode;
}

/** The box a 3D scene draws into, with loading and no-WebGL states. Overlays go in children. */
export function ThreeViewport({ containerRef, status, label, fallback, loadingText, className, children }: ThreeViewportProps) {
  const failed = status === 'unsupported' || status === 'error';
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div ref={containerRef} role="img" aria-label={label} className={cn('absolute inset-0', failed && 'hidden')} />
      {status === 'loading' && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-white/50">{loadingText}</p>
      )}
      {failed ? <div className="absolute inset-0 flex items-center justify-center p-6 text-center">{fallback}</div> : children}
    </div>
  );
}
