import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";

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

/** Client address as seen by the app (tailscale serve / reverse proxies set X-Forwarded-For). */
export function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
