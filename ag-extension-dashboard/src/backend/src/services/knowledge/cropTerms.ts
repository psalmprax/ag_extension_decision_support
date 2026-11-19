/** Crop names recognised in questions, articles and farmer profiles (English). */
export const CROP_PATTERN = /\b(maize|corn|rice|cassava|yam|plantain|banana|cocoa|coffee|cotton|groundnut|peanut|sorghum|millet|bean|cowpea|soybean|sugarcane|oil\s*palm|sweet\s*potato|potato|tomato|onion|wheat|barley|oat|rye|chickpea|lentil|pigeon\s*pea|mango|avocado|citrus|pineapple|papaya|cashew|sesame|sunflower|canola|rapeseed|vegetable)(?:es|s)?\b/gi;

const SYNONYMS: Record<string, string> = { corn: 'maize', peanut: 'groundnut' };

/** Lower-case singular canonical name: "Corn" -> "maize", "Beans" -> "bean". */
export function normalizeCrop(name: string): string {
    const lower = name.toLowerCase().replace(/\s+/g, ' ').trim();
    const singular = lower.endsWith('oes') ? lower.slice(0, -2) : lower.replace(/s$/, '');
    return SYNONYMS[singular] ?? singular;
}

export function cropsMentioned(text: string): string[] {
    return [...new Set([...text.matchAll(new RegExp(CROP_PATTERN.source, 'gi'))].map(match => normalizeCrop(match[1]!)))];
}
