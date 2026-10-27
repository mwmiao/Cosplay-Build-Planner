/**
 * The URL as an absolute http(s) link, or null. Used for every link that comes
 * from outside the app (event listings, feeds, posts): `javascript:`, `data:`
 * and other schemes are dropped, so they can never be stored or rendered as a
 * clickable link. `base` resolves relative links (e.g. "/pt/events/1").
 */
export function safeHttpUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
