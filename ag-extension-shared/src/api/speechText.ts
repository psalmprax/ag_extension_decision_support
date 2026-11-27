/**
 * Text prepared for a voice: what an answer says, without what only works on a screen.
 *
 * Used before every spoken answer, by the server voices and by the browser's own voice:
 *   - markdown, links, code and source markers ("[2]", "[1, 3]") are removed;
 *   - rates and amounts are said in words in the answer's language, from the locale data
 *     built into browsers and Node (CLDR): "2.5 L/ha" becomes "2.5 litres par hectare" in
 *     French and "lita 2.5 kwa kila hekta" in Swahili. The number is kept as written. Where
 *     the locale data has no spoken names for a language, the unit is left as written,
 *     so no unit is ever read in a language other than the answer's;
 *   - fertiliser grades ("NPK 23:10:5", "17-17-17") are read as three numbers, not as a time
 *     or a subtraction.
 */

/** Unit symbols as written in advice, and the CLDR unit each one is. */
const UNITS: Record<string, string> = {
  l: 'liter', L: 'liter', ml: 'milliliter', mL: 'milliliter',
  kg: 'kilogram', g: 'gram', ha: 'hectare',
  mm: 'millimeter', cm: 'centimeter', m: 'meter', km: 'kilometer',
  '%': 'percent', '°C': 'celsius',
};

/** What a rate can be per ("20 ml/L", "50 kg/ha", "5 mm/day"). */
const PER: Record<string, string> = {
  ha: 'hectare', l: 'liter', L: 'liter', kg: 'kilogram', day: 'day', week: 'week',
};

const NUMBER = String.raw`\d+(?:[.,  ]\d+)*`;
const UNIT = '°C|%|mL|ml|kg|km|mm|cm|ha|g|l|L|m';
const AMOUNT = new RegExp(String.raw`(${NUMBER})\s?(${UNIT})(?:\s?/\s?(ha|kg|day|week|l|L))?(?![\p{L}\p{N}])`, 'gu');
const GRADE = /\b(NPK|N-P-K)\s+(\d{1,2})\s*[:\-–]\s*(\d{1,2})\s*[:\-–]\s*(\d{1,2})\b/g;
const NUMERIC_PARTS = new Set(['integer', 'group', 'decimal', 'fraction', 'minusSign', 'plusSign']);

/** The value of a numeral as written in any common style, close enough to choose singular or plural. */
function valueOf(numeral: string): number {
  const compact = numeral.replace(/[  ]/g, '');
  if (/^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(compact)) return Number(compact.replace(/[.,]/g, ''));
  return Number(compact.replace(/,(?=\d+$)/, '.').replace(/[.,](?=.*[.,])/g, ''));
}

function formatter(language: string, unit: string, display: 'long' | 'short'): Intl.NumberFormat | null {
  try {
    const format = new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: display });
    // Only the answer's own language: a language without locale data would fall back to English.
    const resolved = format.resolvedOptions().locale.split('-')[0];
    return resolved === language.split('-')[0] ? format : null;
  } catch {
    return null;
  }
}

/** "2.5 litres par hectare" for ("2.5", "L", "ha") in French, or null when the language has no spoken names. */
export function spokenAmount(numeral: string, symbol: string, per: string | undefined, language: string): string | null {
  const base = UNITS[symbol];
  if (!base) return null;
  const unit = per ? `${base}-per-${PER[per]}` : base;
  const long = formatter(language, unit, 'long');
  const short = formatter(language, unit, 'short');
  const value = valueOf(numeral);
  if (!long || !short || !Number.isFinite(value)) return null;
  const parts = long.formatToParts(value);
  const unitWords = parts.filter(part => !NUMERIC_PARTS.has(part.type)).map(part => part.value).join('').trim();
  const shortWords = short.formatToParts(value).filter(part => !NUMERIC_PARTS.has(part.type)).map(part => part.value).join('').trim();
  if (unitWords === shortWords) return null;
  let numberPlaced = false;
  return parts
    .map(part => {
      if (!NUMERIC_PARTS.has(part.type)) return part.value.replace(/[\u00a0\u202f]/g, ' ');
      if (numberPlaced) return '';
      numberPlaced = true;
      return numeral;
    })
    .join('');
}

/** Markdown, links, code and source markers removed; whitespace collapsed. */
export function withoutMarkup(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, '')
    .replace(/[*_~]{1,3}(.*?)[*_~]{1,3}/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The answer as it should be spoken in `language` (a BCP 47 code such as "en", "fr", "sw"). */
export function speechText(raw: string, language = 'en'): string {
  if (!raw) return '';
  return withoutMarkup(raw)
    .replace(GRADE, (_match, _npk: string, n: string, p: string, k: string) => `NPK ${n}, ${p}, ${k}`)
    .replace(AMOUNT, (match, numeral: string, symbol: string, per: string | undefined) =>
      spokenAmount(numeral, symbol, per, language) ?? match);
}
