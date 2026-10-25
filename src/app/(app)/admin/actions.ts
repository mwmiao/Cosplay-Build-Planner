"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { removePublicationFolder } from "@/lib/community/images";
import { db } from "@/lib/db";
import { type FormState, idSchema } from "@/lib/validation";

/**
 * Admin removal of a Community publication: deletes the public snapshot and its
 * image copies (same effect as the owner unpublishing) and records why. The
 * owner's private project is not modified.
 */
export async function removePublication(publicationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { t } = getI18n();
  const A = t.admin;
  if (!idSchema.safeParse(publicationId).success) return { ok: false, message: A.alreadyGone };
  const reason = z.string().trim().min(3).max(500).safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { ok: false, errors: { reason: [A.reasonRequired] } };

  const removed = await db.$transaction(async (tx) => {
    const publication = await tx.publication.findUnique({ where: { id: publicationId } });
    if (!publication) return null;
    await tx.moderationAction.create({
      data: {
        projectId: publication.projectId,
        ownerId: publication.ownerId,
        adminId: admin.id,
        publicationTitle: publication.title,
        reason: reason.data,
      },
    });
    await tx.publication.delete({ where: { id: publication.id } });
    return publication;
  });
  if (!removed) return { ok: false, message: A.alreadyGone };
  await removePublicationFolder(removed.id);

  revalidatePath("/community", "layout");
  revalidatePath("/admin");
  revalidatePath(`/projects/${removed.projectId}`, "layout");
  // The public page is gone now, so always land on the moderation page with a confirmation.
  redirect("/admin?removed=1");
}
