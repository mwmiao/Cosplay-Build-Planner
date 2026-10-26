"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { copyPublicToPrivate } from "@/lib/community/images";
import { getPublicProject } from "@/lib/community/view";
import { CATEGORIES } from "@/lib/constants";
import { isCurrency } from "@/lib/currencies";
import { db } from "@/lib/db";
import { getDefaultCurrency } from "@/lib/settings";
import { syncShoppingItemForPart } from "@/lib/shopping";
import { mimeForPath, removeProjectFiles } from "@/lib/uploads";
import { idSchema } from "@/lib/validation";

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

  const files = await db.publicImage.findMany({
    where: { publicationId: source.id },
    select: { id: true, filePath: true, thumbPath: true },
  });
  const fileById = new Map(files.map((f) => [f.id, f]));
  const base = source.snapshot.budget?.currency ?? (await getDefaultCurrency(user.id));
  const projectId = newId();

  // Copy the published images into the new project's private folder first.
  const images: { kind: "reference" | "cover"; caption: string | null; filePath: string; thumbPath: string; sizeBytes: number }[] = [];
  try {
    for (const img of source.images) {
      const file = fileById.get(img.id);
      if (!file) continue;
      images.push({ kind: "reference", caption: img.caption, ...(await copyPublicToPrivate(file, projectId)) });
    }
    // The published cover also becomes the copy's main picture (a separate file).
    const coverFile = source.cover ? fileById.get(source.cover.id) : undefined;
    if (coverFile) images.push({ kind: "cover", caption: null, ...(await copyPublicToPrivate(coverFile, projectId)) });
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
            mimeType: mimeForPath(img.filePath),
            sizeBytes: img.sizeBytes,
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
