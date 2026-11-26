/**
 * Adds dictated words to what is already in a field: on a new sentence after a full
 * stop, otherwise after a space, and with the first letter capitalised when it starts
 * a sentence. Whitespace-only dictation leaves the field as it was.
 */
export function appendDictation(current: string, spoken: string): string {
  const words = spoken.trim();
  if (!words) return current;
  const before = current.trimEnd();
  if (!before) return capitalise(words);
  const endsSentence = /[.!?。؟]$/.test(before);
  return `${before} ${endsSentence ? capitalise(words) : words}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
