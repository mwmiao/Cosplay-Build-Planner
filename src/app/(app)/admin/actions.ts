"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAdmin, requireModerator } from "@/lib/auth";
import { removePublicationFolder } from "@/lib/community/images";
import { db } from "@/lib/db";
import { type FormState, idSchema } from "@/lib/validation";

/**
 * Admin removal of a Community publication: deletes the public snapshot and its
 * image copies (same effect as the owner unpublishing) and records why. The
 * owner's private project is not modified.
 */
export async function removePublication(publicationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireModerator();
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

/** Close a project's open reports without removing it (moderators and admins). */
export async function dismissReports(publicationId: string): Promise<void> {
  await requireModerator();
  if (!idSchema.safeParse(publicationId).success) redirect("/admin");
  await db.report.updateMany({ where: { publicationId, status: "open" }, data: { status: "dismissed", handledAt: new Date() } });
  revalidatePath("/admin");
  redirect("/admin?dismissed=1#reports");
}

/**
 * Admins suspend or restore an account: the person is signed out everywhere,
 * can't sign in, and their Community projects are hidden until restored.
 * Nothing is deleted. Admins and yourself can't be suspended. Recorded in the
 * role-change history.
 */
export async function setSuspended(userId: string, on: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(userId) || userId === admin.id) redirect("/admin/users?error=1");
  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, role: true, isAnonymous: true, suspendedAt: true } });
  if (!target || target.isAnonymous || target.role === "admin") redirect("/admin/users?error=1");
  if (Boolean(target.suspendedAt) !== on) {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { suspendedAt: on ? new Date() : null } }),
      db.session.deleteMany({ where: { userId } }),
      db.roleChange.create({
        data: {
          targetId: userId,
          targetName: target.name,
          actorId: admin.id,
          actorName: admin.name,
          fromRole: target.role,
          toRole: on ? "suspended" : "unsuspended",
        },
      }),
    ]);
  }
  revalidatePath("/community", "layout");
  revalidatePath("/admin/users");
  redirect(`/admin/users?changed=${encodeURIComponent(userId)}`);
}

/**
 * Admins grant or remove the moderator role. Admin itself can't be granted or
 * removed here (only with the set-admin command on the server), guests can't be
 * moderators, and the change signs the person out so it applies right away.
 */
export async function setModerator(userId: string, on: boolean): Promise<void> {
  const admin = await requireAdmin();
  // Better Auth user ids (not cuids)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(userId)) redirect("/admin/users?error=1");
  const target = await db.user.findUnique({ where: { id: userId }, select: { name: true, role: true, isAnonymous: true } });
  if (!target || target.isAnonymous || target.role === "admin") redirect("/admin/users?error=1");
  const toRole = on ? "moderator" : "user";
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { role: toRole } }),
    db.session.deleteMany({ where: { userId } }),
    db.roleChange.create({
      data: { targetId: userId, targetName: target.name, actorId: admin.id, actorName: admin.name, fromRole: target.role, toRole },
    }),
  ]);
  revalidatePath("/admin/users");
  redirect(`/admin/users?changed=${encodeURIComponent(userId)}`);
}
