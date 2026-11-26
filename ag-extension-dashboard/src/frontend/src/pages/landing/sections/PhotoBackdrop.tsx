import React from 'react';

interface PhotoBackdropProps {
  src: string;
  width: number;
  height: number;
  /** CSS object-position, to keep the subject of the photo in view. */
  position?: string;
}

/**
 * A section's photo, clearly visible in the middle and fading into the page colour at
 * the top and bottom, so the section joins the plain sections around it without a seam.
 * Loads only when the section comes near, which keeps the first screen fast on slow data.
 */
export function PhotoBackdrop({ src, width, height, position = 'center' }: PhotoBackdropProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: position }}
        className="w-full h-full object-cover opacity-50 saturate-125"
      />
      <div data-scrim className="absolute inset-0 bg-gradient-to-b from-[#0d1a14] via-[#0d1a14]/45 to-[#0d1a14]" />
    </div>
  );
}
