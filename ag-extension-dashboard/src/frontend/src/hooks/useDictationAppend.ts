import { useCallback, useRef } from 'react';
import { appendDictation } from '@/lib/dictationText';

/**
 * A handler that adds dictated words to a text field. Dictation can deliver several
 * phrases before the next render, so each is added to the latest text rather than to
 * the value the field had when the handler was made.
 */
export function useDictationAppend(value: string, setValue: (next: string) => void): (spoken: string) => void {
  const latest = useRef(value);
  latest.current = value;
  return useCallback(
    (spoken: string) => {
      latest.current = appendDictation(latest.current, spoken);
      setValue(latest.current);
    },
    [setValue]
  );
}
