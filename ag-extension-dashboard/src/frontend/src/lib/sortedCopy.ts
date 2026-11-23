/** Sort without mutating the input, including on browsers predating ES2023. */
export function sortedCopy<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return typeof items.toSorted === 'function'
    ? items.toSorted(compare)
    : Array.from(items).sort(compare);
}
