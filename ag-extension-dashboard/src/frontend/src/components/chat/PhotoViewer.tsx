import { useEffect } from 'react';
import { Dialog as HeadlessDialog } from '@headlessui/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { ChatAttachment } from '@/types/dashboard';
import { Dialog } from '@/components/ui/Dialog';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LabelPhotoForm } from '@/components/diagnosisTests/LabelPhotoForm';

interface PhotoViewerProps {
  photos: ChatAttachment[];
  /** The photo shown, or null when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  label: string;
}

const ICON_BUTTON =
  'h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors';

/**
 * A photo at full size inside the app. It replaces opening the file in a new tab, which
 * does nothing in the phone app and opens a signed-out browser from an installed web app.
 * The image loads with the same signed-in session as its thumbnail.
 */
export function PhotoViewer({ photos, index, onIndexChange, label }: PhotoViewerProps) {
  const photo = index === null ? null : photos[index];
  const count = photos.length;
  const step = (delta: number) => index !== null && onIndexChange((index + delta + count) % count);
  // Staff can record what a farmer's photo shows once they have confirmed it in the field.
  const role = useAppStore(state => state.user?.role);
  const canLabel = role === 'extension_officer' || role === 'regional_manager' || role === 'admin';

  const { t } = useLanguage();
  useEffect(() => {
    if (index === null || count < 2) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % count);
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndexChange]);

  return (
    <Dialog open={photo !== null} onClose={() => onIndexChange(null)} size="3xl">
      {photo && index !== null && (
        <div className="flex flex-col">
          <header className="flex items-center gap-2 ps-4 pe-2 py-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <HeadlessDialog.Title className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white truncate">
              {photo.name}
              {count > 1 && <span className="ms-2 font-normal tabular-nums text-slate-500">{t('photo_position', { defaultValue: '{n} of {count}', n: index + 1, count })}</span>}
            </HeadlessDialog.Title>
            <a href={photo.url} download={photo.name} className={ICON_BUTTON} aria-label={t('photo_download', { defaultValue: 'Download {name}', name: photo.name })}>
              <Download className="w-[18px] h-[18px]" aria-hidden="true" />
            </a>
            <button type="button" onClick={() => onIndexChange(null)} className={ICON_BUTTON} aria-label={t('photo_close', { defaultValue: 'Close photo' })}>
              <X className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </header>
          <div className="relative flex items-center justify-center min-h-[40dvh] bg-slate-100 dark:bg-black/40">
            <img src={photo.url} alt={`${label} ${index + 1}: ${photo.name}`} className="max-h-[75dvh] w-auto max-w-full object-contain" />
            {count > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} className={`${ICON_BUTTON} absolute start-2 bg-white/80 dark:bg-black/50`} aria-label={t('photo_previous', { defaultValue: 'Previous photo' })}>
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} className={`${ICON_BUTTON} absolute end-2 bg-white/80 dark:bg-black/50`} aria-label={t('photo_next', { defaultValue: 'Next photo' })}>
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {canLabel && <LabelPhotoForm key={photo.id} uploadId={photo.id} />}
        </div>
      )}
    </Dialog>
  );
}
