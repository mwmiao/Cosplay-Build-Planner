"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type FormState,
  errorState,
  formToObject,
  idSchema,
  schemas,
} from "@/lib/validation";

function revalidate() {
  revalidatePath("/shopping");
  revalidatePath("/projects", "layout");
}

/** Items the user may touch: their own general items or items of their projects. */
function ownedItem(userId: string) {
  return { OR: [{ ownerId: userId }, { project: { ownerId: userId } }] };
}

/**
 * Ticks an item off. For items generated from a part, the part moves
 * needed → ordered (and back again when unticked).
 */
export async function togglePurchased(itemId: string): Promise<void> {
  const user = await requireUser();
  const id = idSchema.parse(itemId);
  await db.$transaction(async (tx) => {
    const item = await tx.shoppingListItem.findFirst({ where: { id, deletedAt: null, ...ownedItem(user.id) } });
    if (!item) notFound();
    const purchased = !item.purchased;
    await tx.shoppingListItem.update({
      where: { id: item.id },
      data: { purchased, purchasedAt: purchased ? new Date() : null },
    });
    if (item.partId) {
      const part = await tx.buildPart.findFirst({
        where: { id: item.partId, deletedAt: null, project: { ownerId: user.id } },
      });
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
  const user = await requireUser();
  const { t } = getI18n();
  const parsed = schemas(t).shoppingItem.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  if (parsed.data.projectId) {
    // The project must be the user's own; never trust the submitted id alone.
    const project = await db.project.findFirst({
      where: { id: parsed.data.projectId, ownerId: user.id, deletedAt: null },
    });
    if (!project) return { ok: false, errors: { projectId: [t.shopping.pickProject] } };
  }
  await db.shoppingListItem.create({ data: { ...parsed.data, ownerId: user.id } });
  revalidate();
  return { ok: true, message: t.shopping.added(parsed.data.name) };
}

/** Removes a manually added item (part items follow their part instead). */
export async function deleteShoppingItem(itemId: string): Promise<void> {
  const user = await requireUser();
  const id = idSchema.parse(itemId);
  await db.shoppingListItem.updateMany({
    where: { id, partId: null, ...ownedItem(user.id) },
    data: { deletedAt: new Date() },
  });
  revalidate();
}

/** Clears the user's ticked-off manual items from the list. */
export async function clearPurchased(): Promise<void> {
  const user = await requireUser();
  await db.shoppingListItem.updateMany({
    where: { purchased: true, partId: null, deletedAt: null, ...ownedItem(user.id) },
    data: { deletedAt: new Date() },
  });
  revalidate();
}
