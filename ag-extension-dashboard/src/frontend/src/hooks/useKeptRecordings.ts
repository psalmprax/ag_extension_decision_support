import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import toast from 'react-hot-toast';
import type { PendingRecordingStore } from '@/lib/pendingRecordings';
import { transcribeRecording, type VoiceMessages } from './voiceTranscription';

interface UseKeptRecordingsOptions {
  /** The field now on screen; only its recordings are sent from here. */
  draftKey?: string;
  language: string;
  store: PendingRecordingStore;
  messagesRef: MutableRefObject<VoiceMessages>;
  /**
   * Puts text into the field that owns `ownerKey`. Returns false when that field is no
   * longer the one on screen, so the recording is left for when it is open again.
   */
  deliver: (text: string, ownerKey: string | undefined, recordedAt: number) => boolean;
}

/**
 * Recordings that could not be turned into text yet (no signal, or the service failing
 * for now), kept on the phone per field. They are sent when the field is open with a
 * connection; one run at a time per recording, and a recording leaves the phone only
 * when its text has reached its own field or the service refused it for good.
 */
export function useKeptRecordings({ draftKey, language, store, messagesRef, deliver }: UseKeptRecordingsOptions) {
  const [pendingCount, setPendingCount] = useState(0);
  // Recordings being sent right now, so a second run (another 'online' event) skips them.
  const claimed = useRef(new Set<string>());

  /** Keeps a recording for later under the field it was made for. */
  const keep = useCallback(
    async (audio: Blob, ownerKey: string | undefined, recordedAt: number, reason: 'offline' | 'retry', notify: boolean) => {
      if (!ownerKey) {
        if (notify) toast.error(messagesRef.current.failed);
        return;
      }
      try {
        await store.save(ownerKey, language, audio, recordedAt);
        if (ownerKey === draftKey) setPendingCount(count => count + 1);
        if (notify) toast(reason === 'offline' ? messagesRef.current.savedOffline : messagesRef.current.savedForRetry, { duration: 6000 });
      } catch (err) {
        console.error('Could not keep the recording on this phone:', err);
        if (notify) toast.error(messagesRef.current.failed);
      }
    },
    [draftKey, language, store, messagesRef]
  );

  const sendKept = useCallback(async () => {
    if (!draftKey) {
      setPendingCount(0);
      return;
    }
    try {
      const kept = await store.list(draftKey);
      setPendingCount(kept.length);
      if (!navigator.onLine) return;
      for (const item of kept) {
        if (claimed.current.has(item.id)) continue;
        claimed.current.add(item.id);
        const outcome = await transcribeRecording(item.audio, item.language, messagesRef.current, `kept-${item.id}`);
        const stays =
          outcome.status === 'offline' ||
          outcome.status === 'retry' ||
          (outcome.status === 'done' && !deliver(outcome.text, item.draftKey, item.savedAt));
        if (stays) {
          claimed.current.delete(item.id);
          return;
        }
        // Delivered, or refused for good (it would fail the same way every time).
        await store.remove(item.id);
        setPendingCount(count => Math.max(0, count - 1));
      }
    } catch (err) {
      console.error('Could not send recordings kept on this phone:', err);
    }
  }, [draftKey, store, messagesRef, deliver]);

  useEffect(() => {
    void sendKept();
    window.addEventListener('online', sendKept);
    return () => window.removeEventListener('online', sendKept);
  }, [sendKept]);

  return { pendingCount, keep };
}
