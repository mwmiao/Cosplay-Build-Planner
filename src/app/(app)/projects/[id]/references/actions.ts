"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeStoredFiles } from "@/lib/uploads";
import { type FormState, formToObject, idSchema, schemas } from "@/lib/validation";

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
    data: { caption: parsed.data.caption ?? null, sourceUrl: parsed.data.sourceUrl ?? null },
  });
  if (result.count !== 1) notFound();
  revalidatePath(`/projects/${pid}`, "layout");
  return { ok: true, message: t.refs.saved };
}

/** Deletes the image row and its files (originals + thumbnail). */
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
  revalidatePath(`/projects/${pid}`, "layout");
}
