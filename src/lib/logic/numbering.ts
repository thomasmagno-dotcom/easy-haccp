/**
 * Pure functions for step numbering — no DB access, fully unit-testable.
 * Used by process-steps and input-subgraph-steps routes.
 */

/**
 * Returns the next sequential step number given an array of existing numbers.
 * Uses max+1 (not count+1) so gaps in the sequence don't produce duplicates.
 * Returns 1 when the array is empty.
 */
export function getNextNumber(existingNumbers: number[]): number {
  if (existingNumbers.length === 0) return 1;
  return Math.max(...existingNumbers) + 1;
}

/**
 * Removes the item with `removedId` from `items`, then reassigns stepNumbers
 * 1-based in the original sort order, returning a new array.
 * All other fields on each item are preserved unchanged.
 */
export function renumberedAfterRemoval<T extends { id: string; stepNumber: number }>(
  items: T[],
  removedId: string,
): T[] {
  return items
    .filter((item) => item.id !== removedId)
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((item, index) => ({ ...item, stepNumber: index + 1 }));
}
