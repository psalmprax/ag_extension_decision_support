import toast from 'react-hot-toast';
import { transcribeAudio } from '@/api/aiService';

/** What turning one recording into text came to. */
export type TranscriptionOutcome =
  | { status: 'done'; text: string; languageSupported: boolean }
  /** No connection: the recording can be kept and sent later. */
  | { status: 'offline' }
  | { status: 'failed' };

/** The words the recorder shows, in the user's language (see useVoiceMessages). */
export interface VoiceMessages {
  listening: string;
  recording: string;
  transcribing: string;
  transcribed: string;
  failed: string;
  languageLimited: string;
  savedOffline: string;
  micDenied: string;
  notSupported: string;
  stopped: string;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording'));
    reader.readAsDataURL(blob);
  });
}

export function stopStreamTracks(stream?: MediaStream): void {
  try {
    stream?.getTracks().forEach(track => track.stop());
  } catch (err) {
    console.warn('Could not release the microphone:', err);
  }
}

interface RequestError {
  response?: { status?: number; data?: { error?: string; details?: { message?: string } } };
}

/** True when the request never reached the server (no signal), as opposed to the server refusing it. */
function isConnectionError(err: unknown): boolean {
  return typeof navigator !== 'undefined' && (!navigator.onLine || !(err as RequestError)?.response);
}

function showServerError(err: unknown, toastId: string, fallback: string): void {
  console.error('Audio transcription error:', err);
  const response = (err as RequestError).response;
  const backendMessage = response?.data?.details?.message || response?.data?.error;
  if (response?.status === 403 && backendMessage) {
    toast.error(backendMessage, { id: toastId, duration: 5000 });
  } else {
    toast.error(backendMessage || fallback, { id: toastId });
  }
}

/**
 * Sends one recording to the server transcriber. Shows progress and the result as a
 * toast, and reports 'offline' instead of an error when there is no connection, so the
 * caller can keep the recording. `successMessage` replaces the usual "done" message.
 */
export async function transcribeRecording(
  blob: Blob,
  language: string,
  messages: VoiceMessages,
  toastId: string,
  successMessage = messages.transcribed
): Promise<TranscriptionOutcome> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { status: 'offline' };
  try {
    const audio = await blobToBase64(blob);
    toast.loading(messages.transcribing, { id: toastId });
    const res = await transcribeAudio(audio, language);
    const text = res.data?.text?.trim();
    if (!res.success || !text) {
      toast.error(messages.failed, { id: toastId });
      return { status: 'failed' };
    }
    const languageSupported = res.data.languageSupported !== false;
    if (languageSupported) toast.success(successMessage, { id: toastId });
    else toast(messages.languageLimited, { id: toastId, duration: 6000 });
    return { status: 'done', text, languageSupported };
  } catch (err) {
    if (isConnectionError(err)) {
      toast.dismiss(toastId);
      return { status: 'offline' };
    }
    showServerError(err, toastId, messages.failed);
    return { status: 'failed' };
  }
}
