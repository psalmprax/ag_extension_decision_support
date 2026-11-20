/**
 * SMS text rules. One GSM-7 SMS holds 160 characters (153 per part when split), but a
 * single emoji or curly quote switches the whole message to UCS-2: 70 characters (67
 * per part), so the same text costs two to three times as much. Everything sent by SMS
 * is cleaned to GSM-7 first.
 */
import { toPlainText } from '@/services/chat/plainText';

/** Characters in the GSM 03.38 basic set and its extension table. */
const GSM_CHARS =
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
    '^{}\\[~]|€';

const REPLACEMENTS: Array<[RegExp, string]> = [
    [/[\u2018\u2019\u201A\u2032]/g, "'"],
    [/[\u201C\u201D\u201E\u2033]/g, '"'],
    [/[\u2013\u2014\u2212]/g, '-'],
    [/\u2026/g, '...'],
    [/[\u00A0\u2007\u202F]/g, ' '],
    [/\u00B0/g, ' deg '],
    [/\u2022/g, '-'],
    [/[\u2192\u21D2]/g, '->'],
];

/** True when every character fits GSM-7, so a part holds 160 (or 153) characters. */
export function isGsm7(text: string): boolean {
    for (const ch of text) if (!GSM_CHARS.includes(ch)) return false;
    return true;
}

/**
 * Plain GSM-7 text for an SMS: markdown removed, emoji and pictographs dropped, typographic
 * punctuation replaced, accents removed where GSM has no letter for them.
 */
export function toSmsText(text: string): string {
    let plain = toPlainText(text)
        .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
        .replace(/\*([^*\n]+)\*/g, '$1');
    for (const [pattern, replacement] of REPLACEMENTS) plain = plain.replace(pattern, replacement);
    plain = [...plain.normalize('NFC')]
        .map(ch => (GSM_CHARS.includes(ch) ? ch : ch.normalize('NFD').replace(/[\u0300-\u036F]/g, '')))
        .map(ch => (GSM_CHARS.includes(ch) ? ch : ''))
        .join('');
    return plain
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

/** Characters per part of a multi-part GSM-7 SMS. */
export const GSM_PART_CHARS = 153;

/**
 * Splits a reply so the first `parts` SMS parts carry as much as fits, ending with the
 * MORE prompt; the rest is returned for a later MORE request.
 */
export function splitForSms(text: string, morePrompt: string, parts = 2): { send: string; rest: string | null } {
    const clean = toSmsText(text);
    const limit = parts === 1 ? 160 : GSM_PART_CHARS * parts;
    if (clean.length <= limit) return { send: clean, rest: null };
    const room = limit - morePrompt.length - 1;
    const head = clean.slice(0, room);
    const cut = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'));
    const at = cut > room * 0.6 ? cut : room;
    return { send: `${clean.slice(0, at).trimEnd()} ${morePrompt}`, rest: clean.slice(at).trim() || null };
}
