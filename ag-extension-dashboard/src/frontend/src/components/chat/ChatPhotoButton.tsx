import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendThreadMessage } from '@/api/chatbotService';
import { uploadFile } from '@/api/uploadService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';

/** The thread a photo goes to, and the farmer it is about (uploads are filed under that farmer). */
export interface PhotoTarget {
  conversationId: string;
  farmerId: string;
}

interface ChatPhotoButtonProps {
  /** Resolves (or starts) the conversation, so a farmer's first message can be a photo. */
  resolveTarget: () => Promise<PhotoTarget>;
  /** Whatever is typed in the composer goes with the photo as its caption. */
  caption: string;
  clearCaption: () => void;
  language?: string;
  onSent: (conversationId: string) => void | Promise<void>;
  disabled?: boolean;
}

const MAX_PHOTOS = 4;

/**
 * Sends photos into a farmer–officer thread: pick up to four images, they are
 * uploaded under the thread's farmer and sent as one message, with the typed
 * text as the caption.
 */
export const ChatPhotoButton: React.FC<ChatPhotoButtonProps> = ({
  resolveTarget,
  caption,
  clearCaption,
  language,
  onSent,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);

  const send = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS) {
      toast.error(`Send at most ${MAX_PHOTOS} photos at a time`);
      return;
    }
    setSending(true);
    try {
      const target = await resolveTarget();
      const uploads = await Promise.all(files.map(file => uploadFile(file, target.farmerId)));
      const ids = uploads.map(upload => upload.id).filter((id): id is string => Boolean(id));
      await sendThreadMessage(target.conversationId, caption.trim(), language, ids);
      clearCaption();
      await onSent(target.conversationId);
    } catch (error) {
      console.error('Sending a photo failed:', error);
      toast.error(getApiErrorMessage(error, t('chat_photo_failed', { defaultValue: 'The photo could not be sent. Try again.' })));
    } finally {
      setSending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label={t('chat_photo_choose', { defaultValue: 'Choose photos to send' })}
        data-testid="chat-photo-input"
        onChange={e => void send(Array.from(e.target.files ?? []))}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || sending}
        aria-label={t('chat_photo_send', { defaultValue: 'Send a photo' })}
        title={t('chat_photo_send', { defaultValue: 'Send a photo' })}
        className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
      </button>
    </>
  );
};
