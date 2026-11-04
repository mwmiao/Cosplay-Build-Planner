/**
 * CSRF guard for cookie-authenticated API routes (server actions already get
 * Next.js's built-in origin check). Browsers send Origin on cross-site POSTs;
 * if it's present it must match the host the request was made to. Without
 * Origin, a browser still says where the request came from in Sec-Fetch-Site
 * (a cross-site one is refused); requests with neither (curl, scripts) pass.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    const site = req.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
