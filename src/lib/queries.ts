import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { MoneyContext } from "./projects";
import { getLatestRates } from "./rates";
import { getDefaultCurrency } from "./settings";
import { idSchema } from "./validation";

/** Loads a non-deleted project or renders the 404 page. */
export async function getProjectOr404(id: string) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const project = await db.project.findFirst({ where: { id: parsed.data, deletedAt: null } });
  if (!project) notFound();
  return project;
}

/** Supplier names already used, for the supplier field's suggestions. */
export async function knownSuppliers(): Promise<string[]> {
  const rows = await db.buildPart.findMany({
    where: { supplier: { not: null }, deletedAt: null },
    distinct: ["supplier"],
    select: { supplier: true },
    orderBy: { supplier: "asc" },
    take: 50,
  });
  return rows.map((r) => r.supplier).filter((s): s is string => Boolean(s));
}

/** Base currency + current rates, for showing converted totals. */
export async function getMoneyContext(): Promise<MoneyContext> {
  const [defaultCurrency, rates] = await Promise.all([getDefaultCurrency(), getLatestRates()]);
  return { defaultCurrency, rates };
}
