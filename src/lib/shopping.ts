import "server-only";
import type { BuildPart, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Keeps a part's shopping-list item in step with the part:
 * - status "needed"  → item exists, not purchased, copies the part's details
 * - any later status → item is marked purchased
 * - part deleted     → item is soft-deleted
 */
export async function syncShoppingItemForPart(tx: Tx, part: BuildPart): Promise<void> {
  const existing = await tx.shoppingListItem.findUnique({ where: { partId: part.id } });
  const details = {
    projectId: part.projectId,
    name: part.name,
    category: part.category,
    supplier: part.supplier,
    url: part.url,
    quantity: part.quantity,
    estimatedCostCents: part.estimatedCostCents,
  };

  if (part.deletedAt) {
    if (existing && !existing.deletedAt) {
      await tx.shoppingListItem.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    }
    return;
  }

  if (part.status === "needed") {
    if (existing) {
      await tx.shoppingListItem.update({
        where: { id: existing.id },
        data: { ...details, purchased: false, purchasedAt: null, deletedAt: null },
      });
    } else {
      await tx.shoppingListItem.create({ data: { ...details, partId: part.id } });
    }
    return;
  }

  if (existing && (!existing.purchased || existing.deletedAt)) {
    await tx.shoppingListItem.update({
      where: { id: existing.id },
      data: { ...details, purchased: true, purchasedAt: existing.purchasedAt ?? new Date(), deletedAt: null },
    });
  } else if (existing) {
    await tx.shoppingListItem.update({ where: { id: existing.id }, data: details });
  }
}
