import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { MoneyContext } from "./projects";
import { getLatestRates } from "./rates";
import { getDefaultCurrency } from "./settings";
import { idSchema } from "./validation";

/**
 * Loads a non-deleted project owned by `userId`, or renders the 404 page.
 * Another user's project looks exactly like a missing one.
 */
export async function getProjectOr404(id: string, userId: string) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const project = await db.project.findFirst({ where: { id: parsed.data, ownerId: userId, deletedAt: null } });
  if (!project) notFound();
  return project;
}

/** Supplier names the user has already used, for the supplier field's suggestions. */
export async function knownSuppliers(userId: string): Promise<string[]> {
  const rows = await db.buildPart.findMany({
    where: { supplier: { not: null }, deletedAt: null, project: { ownerId: userId } },
    distinct: ["supplier"],
    select: { supplier: true },
    orderBy: { supplier: "asc" },
    take: 50,
  });
  return rows.map((r) => r.supplier).filter((s): s is string => Boolean(s));
}

/** The user's base currency + current rates, for showing converted totals. */
export async function getMoneyContext(userId: string): Promise<MoneyContext> {
  const [defaultCurrency, rates] = await Promise.all([getDefaultCurrency(userId), getLatestRates()]);
  return { defaultCurrency, rates };
}
