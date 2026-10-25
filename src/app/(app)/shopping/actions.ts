"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type FormState,
  errorState,
  formToObject,
  idSchema,
  shoppingItemSchema,
} from "@/lib/validation";

function revalidate() {
  revalidatePath("/shopping");
  revalidatePath("/projects", "layout");
}

/**
 * Ticks an item off. For items generated from a part, the part moves
 * needed → ordered (and back again when unticked).
 */
export async function togglePurchased(itemId: string): Promise<void> {
  await requireAuth();
  const id = idSchema.parse(itemId);
  await db.$transaction(async (tx) => {
    const item = await tx.shoppingListItem.findFirstOrThrow({ where: { id, deletedAt: null } });
    const purchased = !item.purchased;
    await tx.shoppingListItem.update({
      where: { id },
      data: { purchased, purchasedAt: purchased ? new Date() : null },
    });
    if (item.partId) {
      const part = await tx.buildPart.findFirst({ where: { id: item.partId, deletedAt: null } });
      if (part && purchased && part.status === "needed") {
        await tx.buildPart.update({ where: { id: part.id }, data: { status: "ordered" } });
      } else if (part && !purchased && part.status === "ordered") {
        await tx.buildPart.update({ where: { id: part.id }, data: { status: "needed" } });
      }
    }
  });
  revalidate();
}

export async function addShoppingItem(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = shoppingItemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error);
  if (parsed.data.projectId) {
    const project = await db.project.findFirst({ where: { id: parsed.data.projectId, deletedAt: null } });
    if (!project) return { ok: false, errors: { projectId: ["Pick a project from the list"] } };
  }
  await db.shoppingListItem.create({ data: parsed.data });
  revalidate();
  return { ok: true, message: `Added “${parsed.data.name}”.` };
}

/** Removes a manually added item (part items follow their part instead). */
export async function deleteShoppingItem(itemId: string): Promise<void> {
  await requireAuth();
  const id = idSchema.parse(itemId);
  await db.shoppingListItem.updateMany({
    where: { id, partId: null },
    data: { deletedAt: new Date() },
  });
  revalidate();
}

/** Clears ticked-off manual items from the list. */
export async function clearPurchased(): Promise<void> {
  await requireAuth();
  await db.shoppingListItem.updateMany({
    where: { purchased: true, partId: null, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  revalidate();
}
