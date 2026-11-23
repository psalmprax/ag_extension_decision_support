export type Point = { label: string; value: number };

/** Keeps only points with a label and a finite number: answers are generated text, not trusted data. */
export function cleanPoints(data: unknown): Point[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(item => {
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    const value = Number(item?.value);
    return label && Number.isFinite(value) ? [{ label, value }] : [];
  });
}
