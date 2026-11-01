"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, requireAccount, requireUser } from "@/lib/auth";
import { copyImageToProject } from "@/lib/community/images";
import { getPublicProject } from "@/lib/community/view";
import { CATEGORIES } from "@/lib/constants";
import { isCurrency } from "@/lib/currencies";
import { db } from "@/lib/db";
import { GUEST_MAX_PROJECTS, guestKey, guestUsage } from "@/lib/guest";
import { getDefaultCurrency } from "@/lib/settings";
import { syncShoppingItemForPart } from "@/lib/shopping";
import { removeProjectFiles } from "@/lib/uploads";
import { rateLimit } from "@/lib/rateLimit";
import { type FormState, idSchema } from "@/lib/validation";
import { REPORT_REASONS } from "@/lib/community/reports";

const newId = () => `c${randomBytes(12).toString("hex")}`;

/**
 * "Copy to My Projects": a new PRIVATE project for the signed-in user, built
 * only from the published snapshot (the same public view visitors get) — never
 * from the original project. It's a planning template: every item starts as
 * "needed" with no actual cost or payment, new ids everywhere, not published,
 * and it credits the original creator. The original is never modified.
 */
export async function copyToMyProjects(publicationId: string): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(publicationId).success) notFound();
  const source = await getPublicProject(publicationId);
  if (!source) notFound();

  if (user.isGuest && (await guestUsage(user.id)).projects >= GUEST_MAX_PROJECTS) redirect("/projects?limit=1");
  // Guests' copies are encrypted with their key, like their uploads.
  const key = user.isGuest ? guestKey() : null;
  if (user.isGuest && !key) redirect("/projects?limit=1");

  // Only images the public page shows right now (getPublicProject applied the allow-list).
  const files = await db.referenceImage.findMany({
    where: { id: { in: source.images.map((i) => i.id) } },
    select: { id: true, filePath: true, thumbPath: true, mimeType: true },
  });
  const fileById = new Map(files.map((f) => [f.id, f]));
  const base = source.snapshot.budget?.currency ?? (await getDefaultCurrency(user.id));
  const projectId = newId();

  // Copy the published images into the new project's private folder first.
  const images: {
    kind: "reference" | "cover";
    caption: string | null;
    mimeType: string;
    filePath: string;
    thumbPath: string;
    sizeBytes: number;
    encrypted: boolean;
  }[] = [];
  try {
    for (const img of source.images) {
      const file = fileById.get(img.id);
      if (!file) continue;
      images.push({ kind: "reference", caption: img.caption, mimeType: file.mimeType, ...(await copyImageToProject(file, projectId, key)) });
    }
    // The published cover also becomes the copy's main picture (a separate file).
    const coverFile = source.cover ? fileById.get(source.cover.id) : undefined;
    if (coverFile) {
      images.push({ kind: "cover", caption: null, mimeType: coverFile.mimeType, ...(await copyImageToProject(coverFile, projectId, key)) });
    }
  } catch (err) {
    console.error("Copying community images failed", err);
    await removeProjectFiles(projectId);
    throw err;
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: projectId,
          ownerId: user.id,
          characterName: source.title,
          series: source.series,
          status: "idea",
          currency: isCurrency(base) ? base : null,
          // The target budget is copied only if the creator published it; their spending never is.
          budgetCents: source.snapshot.budget?.budgetCents ?? null,
          notes: source.description,
          copiedFromPublicationId: source.id,
          copiedFromTitle: source.title,
          copiedFromCreator: source.creator.displayName,
        },
      });
      for (const [position, item] of source.snapshot.items.entries()) {
        const part = await tx.buildPart.create({
          data: {
            projectId,
            position,
            name: item.name,
            category: (CATEGORIES as readonly string[]).includes(item.category) ? item.category : "other",
            status: "needed",
            quantity: item.quantity,
            currency: item.currency && isCurrency(item.currency) ? item.currency : null,
            estimatedCostCents: item.estimatedEachCents ?? null,
            supplier: item.supplier ?? null,
            url: item.url ?? null,
          },
        });
        await syncShoppingItemForPart(tx, part, user.id);
      }
      for (const [position, img] of images.entries()) {
        await tx.referenceImage.create({
          data: {
            projectId,
            kind: img.kind,
            position,
            filePath: img.filePath,
            thumbPath: img.thumbPath,
            originalName: img.filePath.split("/")[1] ?? "image",
            mimeType: img.mimeType,
            sizeBytes: img.sizeBytes,
            encrypted: img.encrypted,
            caption: img.caption,
          },
        });
      }
    });
  } catch (err) {
    console.error("Copy to My Projects failed", err);
    await removeProjectFiles(projectId);
    throw err;
  }

  revalidatePath("/projects");
  revalidatePath("/shopping");
  redirect(`/projects/${projectId}?copied=1`);
}

/**
 * Report a Community project to the moderators. Accounts only (not guests or
 * visitors), never your own project, one open report per person per project,
 * and a daily limit. The owner never learns who reported it.
 */
export async function reportPublication(publicationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const R = t.community.report;
  const user = await getCurrentUser();
  if (!user || user.isGuest) return { ok: false, message: R.needsAccount };
  if (!idSchema.safeParse(publicationId).success) return { ok: false, message: t.admin.alreadyGone };
  const publication = await db.publication.findUnique({ where: { id: publicationId }, select: { ownerId: true } });
  if (!publication) return { ok: false, message: t.admin.alreadyGone };
  if (publication.ownerId === user.id) return { ok: false, message: R.own };
  const input = z
    .object({ reason: z.enum(REPORT_REASONS), note: z.string().trim().max(500).optional() })
    .safeParse({ reason: formData.get("reason"), note: formData.get("note") || undefined });
  if (!input.success) return { ok: false, errors: { reason: [R.reason] } };
  const open = await db.report.findFirst({ where: { publicationId, reporterId: user.id, status: "open" }, select: { id: true } });
  if (open) return { ok: true, message: R.already };
  if (!(await rateLimit(`report:${user.id}`, 10, 24 * 60 * 60))) return { ok: false, message: R.tooMany };
  await db.report.create({
    data: { publicationId, reporterId: user.id, reason: input.data.reason, note: input.data.note || null },
  });
  revalidatePath("/admin");
  return { ok: true, message: R.sent };
}

/** Save or unsave a Community project (accounts only; private to that account). */
export async function toggleBookmark(publicationId: string): Promise<void> {
  const user = await requireAccount();
  if (!idSchema.safeParse(publicationId).success) return;
  const key = { userId_publicationId: { userId: user.id, publicationId } };
  if (await db.bookmark.findUnique({ where: key })) await db.bookmark.delete({ where: key });
  else if (await db.publication.findUnique({ where: { id: publicationId }, select: { id: true } })) {
    await db.bookmark.upsert({ where: key, create: { userId: user.id, publicationId }, update: {} });
  }
  revalidatePath(`/community/${publicationId}`);
  revalidatePath("/community");
}

/** One reaction per account, on other people's projects. Only the count is public. */
export async function toggleReaction(publicationId: string): Promise<void> {
  const user = await requireAccount();
  if (!idSchema.safeParse(publicationId).success) return;
  const key = { userId_publicationId: { userId: user.id, publicationId } };
  if (await db.reaction.findUnique({ where: key })) await db.reaction.delete({ where: key });
  else {
    const publication = await db.publication.findUnique({ where: { id: publicationId }, select: { ownerId: true } });
    if (publication && publication.ownerId !== user.id) {
      await db.reaction.upsert({ where: key, create: { userId: user.id, publicationId }, update: {} });
    }
  }
  revalidatePath(`/community/${publicationId}`);
}
