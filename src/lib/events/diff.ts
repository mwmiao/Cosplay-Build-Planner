// Pure helper shared by the built-in refresh and the daily check (and tests).

/** Field-by-field differences (dates as YYYY-MM-DD), for the review queue. */
export function diffFields(current: Record<string, unknown>, next: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const show = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null));
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(next)) {
    if (JSON.stringify(show(current[k])) !== JSON.stringify(show(v))) out[k] = [show(current[k]), show(v)];
  }
  return out;
}
