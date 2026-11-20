/** GSM 03.38 characters (basic set and extension table): text made only of these is 7-bit. */
const GSM_CHARS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';

/**
 * How many SMS a message takes. 7-bit text fits 160 characters in one SMS and 153 per part
 * when split; one emoji or curly quote makes it UCS-2: 70, or 67 per part.
 */
export function smsParts(text: string): { parts: number; unicode: boolean } {
  if (!text) return { parts: 0, unicode: false };
  const unicode = [...text].some(ch => !GSM_CHARS.includes(ch));
  const length = [...text].length;
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return { parts: length <= single ? 1 : Math.ceil(length / multi), unicode };
}
