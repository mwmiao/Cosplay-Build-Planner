type PartStatus = { status: string; statusBeforeDone: string | null; completedAt: Date | null };

/**
 * What to store when a part's status becomes `next`. While a part is done it remembers the
 * status it had before (so un-ticking can restore it) and when it was completed; both are
 * cleared when it is not done.
 */
export function applyStatus(before: PartStatus, next: string): PartStatus {
  if (next !== "done") return { status: next, statusBeforeDone: null, completedAt: null };
  if (before.status === "done") {
    return { status: next, statusBeforeDone: before.statusBeforeDone, completedAt: before.completedAt ?? new Date() };
  }
  return { status: next, statusBeforeDone: before.status, completedAt: new Date() };
}

/** The status the quick "done" tick moves a part to: done, or back to what it was before (building if unknown). */
export function toggleTarget(before: PartStatus): string {
  if (before.status !== "done") return "done";
  return before.statusBeforeDone ?? "building";
}
