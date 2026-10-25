/**
 * CSRF guard for cookie-authenticated API routes (server actions already get
 * Next.js's built-in origin check). Browsers send Origin on cross-site POSTs;
 * if it's present it must match the host the request was made to.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin form posts from older browsers / non-browser clients
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
