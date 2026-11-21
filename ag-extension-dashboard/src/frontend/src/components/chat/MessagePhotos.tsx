import React, { useState } from 'react';
import type { ChatAttachment } from '@/types/dashboard';
import { PhotoViewer } from './PhotoViewer';

/**
 * Files attached to a chat message, visit report or progress entry. A tap on a photo opens
 * it at full size inside the app; videos and voice notes (sent on WhatsApp or Telegram)
 * play in place. The URLs are served only to people who can see that farmer.
 */
export const MessagePhotos: React.FC<{ photos?: ChatAttachment[]; label: string }> = ({ photos, label }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!photos?.length) return null;
  const images = photos.filter(file => file.mimeType.startsWith('image/'));
  const videos = photos.filter(file => file.mimeType.startsWith('video/'));
  const recordings = photos.filter(file => file.mimeType.startsWith('audio/'));
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {images.map((photo, index) => (
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
      )}
      {videos.map((video, index) => (
        <video
          key={video.id}
          src={video.url}
          controls
          preload="metadata"
          aria-label={`Video ${index + 1}: ${video.name}`}
          className="w-full max-w-sm rounded-lg border border-black/10 dark:border-white/10 bg-black"
        />
      ))}
      {recordings.map((recording, index) => (
        <audio
          key={recording.id}
          src={recording.url}
          controls
          preload="none"
          aria-label={`Voice note ${index + 1}: ${recording.name}`}
          className="w-full max-w-sm"
        />
      ))}
      <PhotoViewer photos={images} index={openIndex} onIndexChange={setOpenIndex} label={label} />
    </div>
  );
};
