/**
 * Audio helpers for text-to-speech normalization and single-channel audio management.
 */

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
 * Strips markdown formatting, links, and code markup so text sounds natural when read aloud.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Convert markdown links [text](url) to just text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italics
    .replace(/[*_~]{1,3}(.*?)[*_~]{1,3}/g, '$1')
    // Strip markdown headings #, ##, etc.
    .replace(/^#+\s+/gm, '')
    // Strip blockquotes
    .replace(/^>\s+/gm, '')
    // Strip bullet points
    .replace(/^[-*+]\s+/gm, '')
    // Replace multiple newlines or spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
}
