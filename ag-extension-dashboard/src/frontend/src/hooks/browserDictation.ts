/** The browser's own dictation (the Web Speech API), as the field recorder uses it. */

/** Browser dictation errors that just mean "nothing was said" or "the user stopped". */
export const QUIET_SPEECH_ERRORS = new Set(['no-speech', 'aborted']);
/** The browser cannot dictate this language, or cannot reach its speech service: record for the server instead. */
export const RECORD_INSTEAD_ERRORS = new Set(['language-not-supported', 'network']);

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const win: SpeechWindow = window as Window & SpeechWindow;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}
