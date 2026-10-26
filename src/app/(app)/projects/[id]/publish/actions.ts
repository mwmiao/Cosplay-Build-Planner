"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAccount } from "@/lib/auth";
import { removePublicationFolder } from "@/lib/community/images";
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

/** Owner's project (or 404). Ownership always comes from the session; guests can't publish. */
async function ownedProject(projectId: string, userId: string) {
  const id = idSchema.safeParse(projectId);
  if (!id.success) notFound();
  const project = await db.project.findFirst({ where: { id: id.data, ownerId: userId, deletedAt: null } });
  if (!project) notFound();
  return project;
}

/**
 * Published projects are live: this stores the owner's publish SETTINGS
 * (public title, description, tags, which optional fields and which images)
 * and the public page is built from the current project on every view.
 * "Preview" shows exactly that without saving; "Publish" saves the settings.
 */
export async function previewOrPublish(projectId: string, _prev: PublishState, formData: FormData): Promise<PublishState> {
  const user = await requireAccount();
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
  const imageMode = formData.get("imageMode") === "selected" ? "selected" : "all";

  // Main picture first, then reference images in the owner's order. Only this
  // project's images can be selected; part photos and guest images never.
  const candidates = await db.referenceImage.findMany({
    where: { projectId: project.id, kind: { in: ["cover", "reference"] }, encrypted: false },
    orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  const wanted = new Set(formData.getAll("imageIds").filter((v): v is string => typeof v === "string"));
  const images = imageMode === "all" ? candidates : candidates.filter((i) => wanted.has(i.id));
  const cover = images.find((i) => i.kind === "cover") ?? images[0] ?? null;

  const parts = await db.buildPart.findMany({
    where: { projectId: project.id, deletedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
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
        images: images.map((i) => ({
          id: i.id,
          caption: i.kind === "cover" ? (i.caption ?? C.mainPicture) : i.caption,
          thumbUrl: `/api/uploads/${i.thumbPath}`,
        })),
        coverId: cover?.id ?? null,
      },
    };
  }

  const data = {
    title: parsed.data.title,
    series: project.series,
    description,
    tags: JSON.stringify(parsed.data.tags),
    ...options,
    imageMode,
    selectedImageIds: JSON.stringify(images.map((i) => i.id)),
    // Kept for reference only; public pages are built live.
    snapshot: JSON.stringify(snapshot),
    coverImageId: null,
  };
  const existing = await db.publication.findUnique({ where: { projectId: project.id }, select: { id: true } });
  if (existing) {
    await db.$transaction([
      // Image copies from before live publishing are no longer used.
      db.publicImage.deleteMany({ where: { publicationId: existing.id } }),
      db.publication.update({
        where: { id: existing.id, ownerId: user.id },
        data: { ...data, version: { increment: 1 }, versionAt: new Date() },
      }),
    ]);
    await removePublicationFolder(existing.id);
  } else {
    await db.publication.create({ data: { id: newId(), projectId: project.id, ownerId: user.id, ...data } });
  }

  revalidatePath("/community", "layout");
  revalidatePath(`/projects/${project.id}`, "layout");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}?published=1`);
}

/** Removes the publication; every public URL for it (page, data, images) stops working. */
export async function unpublish(projectId: string): Promise<void> {
  const user = await requireAccount();
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
