import React, { useState } from 'react';
import type { ChatAttachment } from '@/types/dashboard';
import { PhotoViewer } from './PhotoViewer';

/**
 * Photos attached to a chat message, visit report or progress entry. A tap opens the
 * photo at full size inside the app. The image URLs are served only to people who can
 * see that farmer, using the signed-in session.
 */
export const MessagePhotos: React.FC<{ photos?: ChatAttachment[]; label: string }> = ({ photos, label }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!photos?.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Open ${label.toLowerCase()} ${index + 1}: ${photo.name}`}
              className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <img
                src={photo.url}
                alt={`${label} ${index + 1}: ${photo.name}`}
                loading="lazy"
                className="w-28 h-28 object-cover bg-slate-100 dark:bg-slate-800"
              />
            </button>
          </li>
        ))}
      </ul>
      <PhotoViewer photos={photos} index={openIndex} onIndexChange={setOpenIndex} label={label} />
    </>
  );
};
