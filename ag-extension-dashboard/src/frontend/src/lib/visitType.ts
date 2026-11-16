/** "pest_control" → "Pest control": visit types are stored as codes. */
export function visitTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Routine visit';
  const words = type.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Routine visit';
}
