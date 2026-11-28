import React from 'react';

interface PhotoHeaderBandProps {
  src: string;
  width: number;
  height: number;
  /** CSS object-position, to keep the subject of the photo in view. */
  position?: string;
  className?: string;
  children: React.ReactNode;
  /** Controls under the header (tabs, search, filters), on a solid strip so they stay readable. */
  footer?: React.ReactNode;
}

/**
 * A page header over a field photo. The photo fills the right of the band and fades into the
 * page colour behind the text, so the heading reads the same in light and dark themes.
 */
export function PhotoHeaderBand({ src, width, height, position = 'center', className = '', children, footer }: PhotoHeaderBandProps) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        decoding="async"
        style={{ objectPosition: position }}
        className="absolute inset-y-0 right-0 w-full sm:w-3/4 h-full object-cover pointer-events-none"
      />
      <div data-scrim aria-hidden="true" className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white from-30% via-white/90 via-55% to-white/40 dark:from-theme-bg-primary dark:via-theme-bg-primary/90 dark:to-theme-bg-primary/40" />
      <div className="relative px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      {footer && (
        <div className="relative px-4 py-4 sm:px-6 bg-white dark:bg-theme-bg-primary border-t border-slate-900/[0.08] dark:border-white/[0.08]">
          {footer}
        </div>
      )}
    </div>
  );
}
