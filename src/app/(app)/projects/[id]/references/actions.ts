"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reorderPositions } from "@/lib/ordering";
import { removeStoredFiles } from "@/lib/uploads";
import { type FormState, formToObject, idSchema, schemas } from "@/lib/validation";

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
}

export async function updateReference(
  projectId: string,
  imageId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(imageId);
  const { t } = getI18n();
  const parsed = schemas(t).reference.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const result = await db.referenceImage.updateMany({
    where: { id, projectId: pid, project: { ownerId: user.id, deletedAt: null } },
    data: {
      caption: parsed.data.caption ?? null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      // Groups only apply to reference images; part photos ignore the field.
      ...(formData.has("groupName") ? { groupName: parsed.data.groupName ?? null } : {}),
    },
  });
  if (result.count !== 1) notFound();
  revalidate(pid);
  return { ok: true, message: t.refs.saved };
}

/** Deletes the image row and its files (originals + thumbnail). Any kind: reference, part photo or main picture. */
export async function deleteReference(projectId: string, imageId: string): Promise<void> {
  const user = await requireUser();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(imageId);
  const image = await db.referenceImage.findFirst({
    where: { id, projectId: pid, project: { ownerId: user.id, deletedAt: null } },
  });
  if (!image) notFound();
  await db.referenceImage.delete({ where: { id } });
  await removeStoredFiles(image.filePath, image.thumbPath);
  revalidate(pid);
}

/** Removes the project's main picture (if any). */
export async function removeCover(projectId: string): Promise<void> {
  const user = await requireUser();
  const pid = idSchema.parse(projectId);
  const project = await db.project.findFirst({ where: { id: pid, ownerId: user.id, deletedAt: null }, select: { id: true } });
  if (!project) notFound();
  const covers = await db.referenceImage.findMany({ where: { projectId: pid, kind: "cover" } });
  await db.referenceImage.deleteMany({ where: { projectId: pid, kind: "cover" } });
  await removeStoredFiles(...covers.flatMap((c) => [c.filePath, c.thumbPath]));
  revalidate(pid);
}

const idList = z.array(idSchema).min(1).max(500);

/**
 * Saves a new order for some of the project's images (all of one kind, or one
 * part's photos). Only the listed images move, among the slots they already
 * hold, so reordering a filtered view leaves the others in place.
 */
export async function reorderImages(projectId: string, ids: string[]): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const pid = idSchema.parse(projectId);
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false };
  const ok = await db.$transaction(async (tx) => {
    const rows = await tx.referenceImage.findMany({
      where: { id: { in: parsed.data }, projectId: pid, project: { ownerId: user.id, deletedAt: null } },
      select: { id: true, position: true, kind: true, partId: true },
    });
    // Every id must be ours, and they must belong to one list.
    if (rows.length !== new Set(parsed.data).size) return false;
    if (new Set(rows.map((r) => `${r.kind}:${r.partId ?? ""}`)).size !== 1) return false;
    for (const { id, position } of reorderPositions(rows, parsed.data)) {
      await tx.referenceImage.update({ where: { id }, data: { position } });
    }
    return true;
  });
  if (ok) revalidate(pid);
  return { ok };
}

/** Updates a progress photo's day, stage and caption. */
export async function updateProgress(
  projectId: string,
  imageId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(imageId);
  const { t } = getI18n();
  const parsed = schemas(t).progress.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const result = await db.referenceImage.updateMany({
    where: { id, projectId: pid, kind: "progress", project: { ownerId: user.id, deletedAt: null } },
    data: {
      caption: parsed.data.caption ?? null,
      stage: parsed.data.stage ?? null,
      ...(parsed.data.takenAt ? { takenAt: parsed.data.takenAt } : {}),
    },
  });
  if (result.count !== 1) notFound();
  revalidate(pid);
  return { ok: true, message: t.refs.saved };
}
