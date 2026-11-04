import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { pickClientIp } from "./clientIp";
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

/**
 * Client address for rate limiting (see pickClientIp for how TRUSTED_PROXY
 * decides which header is believed). Per-account limits apply regardless.
 */
export function clientIp(): string {
  const h = headers();
  return pickClientIp((name) => h.get(name), env().TRUSTED_PROXY);
}
