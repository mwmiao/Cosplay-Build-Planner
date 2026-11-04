import type { PrismaClient } from "@prisma/client";

/** Deletes rate-limit counters whose window ended more than a day ago. Returns how many. */
export async function purgeRateLimits(client: Pick<PrismaClient, "authRateLimit">, now = new Date()): Promise<number> {
  const { count } = await client.authRateLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  return count;
}
