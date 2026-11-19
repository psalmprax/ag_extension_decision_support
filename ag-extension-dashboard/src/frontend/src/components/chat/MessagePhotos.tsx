import React from 'react';
import type { ChatAttachment } from '@/types/dashboard';

/**
 * Photos attached to a chat message, visit report or progress entry. Each
 * opens full size in a new tab; the image URLs are served only to people who
 * can see that farmer, using the signed-in session.
 */
export const MessagePhotos: React.FC<{ photos?: ChatAttachment[]; label: string }> = ({ photos, label }) => {
  if (!photos?.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={label}>
      {photos.map((photo, index) => (
        <a
          key={photo.id}
          role="listitem"
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10"
        >
          <img
            src={photo.url}
            alt={`${label} ${index + 1}: ${photo.name}`}
            loading="lazy"
            className="w-28 h-28 object-cover bg-slate-100 dark:bg-slate-800"
          />
        </a>
      ))}
    </div>
  );
};
