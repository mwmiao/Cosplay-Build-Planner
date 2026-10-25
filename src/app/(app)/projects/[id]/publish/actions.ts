"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { copyToPublic, removePublicFiles, removePublicationFolder } from "@/lib/community/images";
import { type PublicSnapshot, buildPublicSnapshot } from "@/lib/community/snapshot";
import { db } from "@/lib/db";
import { getMoneyContext } from "@/lib/queries";
import { type FormState, idSchema } from "@/lib/validation";

export type PreviewImage = { id: string; caption: string | null; thumbUrl: string };
export type PublishPreview = {
  title: string;
  series: string | null;
  description: string | null;
  tags: string[];
  creatorName: string;
  snapshot: PublicSnapshot;
  images: PreviewImage[];
  coverId: string | null;
};
export type PublishState = FormState & { preview?: PublishPreview };

const newId = () => `c${randomBytes(12).toString("hex")}`;

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

/** Owner's project (or 404). Ownership always comes from the session. */
async function ownedProject(projectId: string, userId: string) {
  const id = idSchema.safeParse(projectId);
  if (!id.success) notFound();
  const project = await db.project.findFirst({ where: { id: id.data, ownerId: userId, deletedAt: null } });
  if (!project) notFound();
  return project;
}

/**
 * "Preview" builds the public snapshot and returns it for display (nothing is
 * stored). "Publish" stores a new snapshot version and copies the selected images.
 */
export async function previewOrPublish(projectId: string, _prev: PublishState, formData: FormData): Promise<PublishState> {
  const user = await requireUser();
  const project = await ownedProject(projectId, user.id);
  const { t } = getI18n();
  const C = t.community;

  const parsed = z
    .object({
      title: z.string().trim().min(1, t.validation.required(C.publicTitle)).max(120, t.validation.tooLong(120)),
      description: z.string().trim().max(2000, t.validation.tooLong(2000)),
      tags: z
        .string()
        .transform((s) => [...new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))])
        .refine((tags) => tags.length <= 10, C.tooManyTags)
        .refine((tags) => tags.every((x) => x.length <= 30), C.tagTooLong),
    })
    .safeParse({
      title: formData.get("title") ?? "",
      description: formData.get("description") ?? "",
      tags: formData.get("tags") ?? "",
    });
  if (!parsed.success) {
    return { ok: false, message: t.common.fixFields, errors: parsed.error.flatten().fieldErrors };
  }
  const options = {
    includeBudget: checkbox(formData, "includeBudget"),
    includeCosts: checkbox(formData, "includeCosts"),
    includeLinks: checkbox(formData, "includeLinks"),
  };

  // Only this project's images can be selected; anything else is ignored.
  const wanted = formData.getAll("imageIds").filter((v): v is string => typeof v === "string");
  const images = wanted.length
    ? await db.referenceImage.findMany({ where: { projectId: project.id, id: { in: wanted } }, orderBy: { createdAt: "asc" } })
    : [];
  const coverWanted = formData.get("coverId");
  const cover = images.find((i) => i.id === coverWanted) ?? images[0] ?? null;

  const parts = await db.buildPart.findMany({
    where: { projectId: project.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const ctx = await getMoneyContext(user.id);
  const snapshot = buildPublicSnapshot(project, parts, options, ctx);
  const description = parsed.data.description || null;

  if (formData.get("intent") !== "publish") {
    return {
      ok: true,
      preview: {
        title: parsed.data.title,
        series: project.series,
        description,
        tags: parsed.data.tags,
        creatorName: user.name,
        snapshot,
        // Preview uses the owner's private thumbnails; nothing is public yet.
        images: images.map((i) => ({ id: i.id, caption: i.caption, thumbUrl: `/api/uploads/${i.thumbPath}` })),
        coverId: cover?.id ?? null,
      },
    };
  }

  const existing = await db.publication.findUnique({
    where: { projectId: project.id },
    include: { images: { select: { filePath: true, thumbPath: true } } },
  });
  const publicationId = existing?.id ?? newId();

  // 1) Copy the chosen images (fresh names) before touching the database.
  const copies: { id: string; sourceImageId: string; caption: string | null; filePath: string; thumbPath: string }[] = [];
  try {
    for (const img of images) {
      const copied = await copyToPublic(publicationId, img);
      copies.push({ id: newId(), sourceImageId: img.id, caption: img.caption, ...copied });
    }
  } catch (err) {
    console.error("Copying images for publication failed", err);
    await removePublicFiles(...copies.flatMap((c) => [c.filePath, c.thumbPath]));
    return { ok: false, message: t.transfer.errors.failed };
  }
  const coverCopyId = copies.find((c) => c.sourceImageId === cover?.id)?.id ?? null;

  // 2) Swap the published version in one transaction.
  const data = {
    title: parsed.data.title,
    series: project.series,
    description,
    tags: JSON.stringify(parsed.data.tags),
    ...options,
    snapshot: JSON.stringify(snapshot),
    coverImageId: coverCopyId,
  };
  try {
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.publicImage.deleteMany({ where: { publicationId } });
        await tx.publication.update({
          where: { id: publicationId, ownerId: user.id },
          data: { ...data, version: { increment: 1 }, versionAt: new Date() },
        });
      } else {
        await tx.publication.create({ data: { id: publicationId, projectId: project.id, ownerId: user.id, ...data } });
      }
      for (const [position, c] of copies.entries()) {
        await tx.publicImage.create({
          data: { id: c.id, publicationId, sourceImageId: c.sourceImageId, caption: c.caption, filePath: c.filePath, thumbPath: c.thumbPath, position },
        });
      }
    });
  } catch (err) {
    console.error("Publishing failed", err);
    await removePublicFiles(...copies.flatMap((c) => [c.filePath, c.thumbPath]));
    return { ok: false, message: t.transfer.errors.failed };
  }

  // 3) Only now remove the previous version's copies.
  if (existing) await removePublicFiles(...existing.images.flatMap((i) => [i.filePath, i.thumbPath]));

  revalidatePath("/community", "layout");
  revalidatePath(`/projects/${project.id}`, "layout");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}?published=1`);
}

/** Removes the publication, its public image copies and every public URL for it. */
export async function unpublish(projectId: string): Promise<void> {
  const user = await requireUser();
  const project = await ownedProject(projectId, user.id);
  const publication = await db.publication.findFirst({ where: { projectId: project.id, ownerId: user.id } });
  if (publication) {
    await db.publication.delete({ where: { id: publication.id } });
    await removePublicationFolder(publication.id);
  }
  revalidatePath("/community", "layout");
  revalidatePath(`/projects/${project.id}`, "layout");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}?unpublished=1`);
}
