import { useState, useEffect, useCallback, useRef } from 'react';

export interface SpeechRecognitionOptions {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

/**
 * useSpeechRecognition — wraps the experimental Web Speech API.
 * Returns null isSupported on SSR / unsupported browsers (e.g. Firefox desktop).
 *
 * Implementation note: the SpeechRecognition instance is created ONCE and
 * never torn down on parent re-renders. Callbacks are kept in refs that are
 * updated when the parent re-renders, so the recognition object always calls
 * the latest handler without re-instantiation.
 */
export const useSpeechRecognition = (options: SpeechRecognitionOptions) => {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(options.onResult);
  const onErrorRef = useRef(options.onError);
  const onEndRef = useRef(options.onEnd);

  // Keep callback refs in sync with the latest props
  useEffect(() => {
    onResultRef.current = options.onResult;
    onErrorRef.current = options.onError;
    onEndRef.current = options.onEnd;
  }, [options.onResult, options.onError, options.onEnd]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }
    const SpeechRecognitionConstructor =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang =
      (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const transcript = finalTranscript || interimTranscript;
      onResultRef.current(transcript, Boolean(finalTranscript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => onErrorRef.current(event.error);
    recognition.onend = () => onEndRef.current();

    recognitionRef.current = recognition;

    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []); // Empty deps: instance is created once and never recreated

  const start = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      onErrorRef.current('not-supported');
      return;
    }
    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if called when already started — stop first
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { start, stop, isSupported };
};
