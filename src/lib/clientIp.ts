/**
 * Picks the visitor's address from request headers for rate limiting.
 * - "cloudflare": only CF-Connecting-IP (set by Cloudflare, can't be faked).
 * - "proxy": only the LAST X-Forwarded-For entry, the one your own proxy added;
 *   earlier entries come from the client.
 * - unset: any of them, first match (fine on a private network, where nobody
 *   benefits from faking their address).
 */
export function pickClientIp(get: (name: string) => string | null, trusted?: "cloudflare" | "proxy"): string {
  if (trusted === "cloudflare") return get("cf-connecting-ip")?.trim() || "local";
  if (trusted === "proxy") return get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
  return (
    get("cf-connecting-ip")?.trim() ||
    get("x-forwarded-for")?.split(",")[0]?.trim() ||
    get("x-real-ip")?.trim() ||
    "local"
  );
}
