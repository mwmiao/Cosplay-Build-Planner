/**
 * New positions for a reordered subset: the items keep the set of position
 * slots they already occupy (sorted), assigned in the requested order. Ties
 * and gaps are fine; unrelated items are never touched.
 */
export function reorderPositions(
  rows: { id: string; position: number }[],
  orderedIds: string[],
): { id: string; position: number }[] {
  const slots = rows.map((r) => r.position).sort((a, b) => a - b);
  // Duplicate positions (e.g. all 0) would make the order ambiguous: spread them.
  const distinct = slots.every((p, i) => i === 0 || p > slots[i - 1]!);
  const base = slots[0] ?? 0;
  const positions = distinct ? slots : slots.map((_, i) => base + i);
  const seen = new Set<string>();
  const order = orderedIds.filter((id) => !seen.has(id) && seen.add(id));
  return order.map((id, i) => ({ id, position: positions[i]! }));
}
