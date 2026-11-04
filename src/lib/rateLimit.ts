import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";
import { env } from "./env";

/**
 * Fixed-window rate limiting for login, registration and password reset,
 * stored in the database so limits survive restarts. Keys are hashed, so
 * emails and IPs aren't stored in readable form.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const id = createHash("sha256").update(key).digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  return db.$transaction(async (tx) => {
    const row = await tx.authRateLimit.findUnique({ where: { key: id } });
    if (!row || row.windowStart < windowStart) {
      await tx.authRateLimit.upsert({
        where: { key: id },
        create: { key: id, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return true;
    }
    if (row.count >= max) return false;
    await tx.authRateLimit.update({ where: { key: id }, data: { count: { increment: 1 } } });
    return true;
  });
}

/** Deletes counters whose window ended more than a day ago. Returns how many. */
export async function purgeRateLimits(now = new Date()): Promise<number> {
  const { count } = await db.authRateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  return count;
}

/**
 * Client address for rate limiting.
 * - Behind a Cloudflare Tunnel, CF-Connecting-IP is set by Cloudflare and a
 *   visitor can't fake it, so it wins.
 * - Otherwise X-Forwarded-For (tailscale serve / other proxies), then X-Real-IP.
 * Per-account limits apply regardless of the address.
 * With TRUSTED_PROXY set, only that proxy's header is believed (a visitor
 * reaching the app directly can't pick their own address by sending headers).
 */
export function clientIp(): string {
  const h = headers();
  const trusted = env().TRUSTED_PROXY;
  if (trusted === "cloudflare") return h.get("cf-connecting-ip")?.trim() || "local";
  // The last entry is the one the proxy itself appended; earlier ones come from the client.
  if (trusted === "proxy") return h.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "local"
  );
}
