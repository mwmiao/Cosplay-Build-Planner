import "server-only";
import type { Dict } from "@/i18n";
import { categoryLabel } from "./constants";
import { db } from "./db";
import type { MoneyContext } from "./projects";
import { crossRate } from "./rates";

export type GroupBy = "supplier" | "category" | "project";

export function parseGroup(value: string | undefined): GroupBy {
  return value === "category" || value === "project" ? value : "supplier";
}

/** The user's items: their general items plus items from their active projects. */
export async function loadShoppingItems(userId: string, includePurchased: boolean) {
  return db.shoppingListItem.findMany({
    where: {
      deletedAt: null,
      ...(includePurchased ? {} : { purchased: false }),
      OR: [
        { projectId: null, ownerId: userId },
        { project: { ownerId: userId, deletedAt: null, archivedAt: null } },
      ],
    },
    include: { project: { select: { id: true, characterName: true, currency: true } } },
    orderBy: [{ purchased: "asc" }, { name: "asc" }],
  });
}

export type ShoppingRow = Awaited<ReturnType<typeof loadShoppingItems>>[number];

export function groupKey(item: ShoppingRow, by: GroupBy, t: Dict): string {
  if (by === "category") return categoryLabel(item.category, t);
  if (by === "project") return item.project?.characterName ?? t.common.general;
  return item.supplier?.trim() || t.shopping.noSupplier;
}

export function groupItems(items: ShoppingRow[], by: GroupBy, t: Dict) {
  const groups = new Map<string, ShoppingRow[]>();
  for (const item of items) {
    const key = groupKey(item, by, t);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  // Alphabetical, with the catch-all buckets last.
  const last = new Set([t.shopping.noSupplier, t.common.general, t.category.other]);
  return [...groups.entries()].sort(([a], [b]) => {
    if (last.has(a) !== last.has(b)) return last.has(a) ? 1 : -1;
    return a.localeCompare(b, t.intl);
  });
}

export function itemTotal(item: Pick<ShoppingRow, "estimatedCostCents" | "quantity">): number {
  return (item.estimatedCostCents ?? 0) * item.quantity;
}

/** The item's own currency: its own, else its project's, else the default. */
export function itemCurrency(item: ShoppingRow, ctx: MoneyContext): string {
  return item.currency ?? item.project?.currency ?? ctx.defaultCurrency;
}

/**
 * Estimated totals in the default currency at today's rates. Items whose
 * currency has no rate yet are left out and reported in `missing`.
 */
export function convertedTotal(items: ShoppingRow[], ctx: MoneyContext) {
  let total = 0;
  let converted = false;
  const missing = new Set<string>();
  for (const i of items) {
    if (i.estimatedCostCents === null) continue;
    const cur = itemCurrency(i, ctx);
    const rate = crossRate(ctx.rates, cur, ctx.defaultCurrency);
    if (rate === null) {
      missing.add(cur);
      continue;
    }
    if (cur !== ctx.defaultCurrency) converted = true;
    total += Math.round(itemTotal(i) * rate);
  }
  return { total, converted, missing: [...missing] };
}
