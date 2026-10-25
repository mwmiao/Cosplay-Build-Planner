"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeStoredFiles } from "@/lib/uploads";
import { type FormState, formToObject, idSchema, referenceSchema } from "@/lib/validation";

export async function updateReference(
  projectId: string,
  imageId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(imageId);
  const parsed = referenceSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  await db.referenceImage.update({
    where: { id, projectId: pid },
    data: { caption: parsed.data.caption ?? null, sourceUrl: parsed.data.sourceUrl ?? null },
  });
  revalidatePath(`/projects/${pid}`, "layout");
  return { ok: true, message: "Saved." };
}

/** Deletes the image row and its files (originals + thumbnail). */
export async function deleteReference(projectId: string, imageId: string): Promise<void> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(imageId);
  const image = await db.referenceImage.findFirst({ where: { id, projectId: pid } });
  if (!image) return;
  await db.referenceImage.delete({ where: { id } });
  await removeStoredFiles(image.filePath, image.thumbPath);
  revalidatePath(`/projects/${pid}`, "layout");
}
