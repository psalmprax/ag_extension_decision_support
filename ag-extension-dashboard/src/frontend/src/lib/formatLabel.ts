/**
 * Turns a stored enum value ("pending", "in_review", "high-risk") into a
 * sentence-case label ("Pending", "In review", "High risk"). Values that are
 * already written for people (any capital letter, e.g. "SMS", "PayPal",
 * "IPM & Pest") are returned unchanged.
 */
export function formatLabel(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (!text || /[A-Z]/.test(text)) return text;
  const spaced = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
