/**
 * Audio helpers for text-to-speech normalization and single-channel audio management.
 */
import { speechText } from '@ag-extension/shared/api';
import { appLanguage } from '@/lib/appLocale';

let activeAudioElement: HTMLAudioElement | null = null;
let activeStopCallback: (() => void) | null = null;

/**
 * Register currently active HTMLAudioElement and stop callback.
 */
export function setActiveAudioPlayback(
  audio: HTMLAudioElement | null,
  stopCb: (() => void) | null
): void {
  activeAudioElement = audio;
  activeStopCallback = stopCb;
}

/**
 * Cancel and stop any active audio playback across the window (SpeechSynthesis or HTML Audio).
 */
export function stopAllAudioPlayback(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeAudioElement = null;
  }
  if (activeStopCallback) {
    activeStopCallback();
    activeStopCallback = null;
  }
}

/**
 * The text as it should be spoken in `language`: markup and source markers removed, and
 * rates such as "2.5 L/ha" said in words in that language (see speechText in the shared package).
 */
export function cleanTextForSpeech(raw: string, language: string = appLanguage()): string {
  return speechText(raw, language);
}
