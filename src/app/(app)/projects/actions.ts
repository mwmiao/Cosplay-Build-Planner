"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeProjectFiles } from "@/lib/uploads";
import {
  type FormState,
  errorState,
  formToObject,
  idSchema,
  projectSchema,
} from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/projects", "layout");
  revalidatePath("/shopping");
  revalidatePath("/settings");
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = projectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error);

  const project = await db.project.create({ data: parsed.data });
  revalidateAll();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const projectId = idSchema.parse(id);
  const parsed = projectSchema.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error);

  // Optional fields left blank are cleared rather than kept.
  const d = parsed.data;
  await db.project.update({
    where: { id: projectId, deletedAt: null },
    data: {
      characterName: d.characterName,
      series: d.series ?? null,
      conventionName: d.conventionName ?? null,
      deadline: d.deadline ?? null,
      status: d.status,
      budgetCents: d.budgetCents ?? null,
      spentCents: d.spentCents ?? null,
      notes: d.notes ?? null,
    },
  });
  revalidateAll();
  redirect(`/projects/${projectId}`);
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  await requireAuth();
  const projectId = idSchema.parse(id);
  await db.project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
  });
  revalidateAll();
  redirect(archived ? "/projects" : `/projects/${projectId}`);
}

/** Soft delete: the project moves to Settings → Deleted projects, where it can be restored. */
export async function deleteProject(id: string): Promise<void> {
  await requireAuth();
  const projectId = idSchema.parse(id);
  await db.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  revalidateAll();
  redirect("/projects");
}

export async function restoreProject(id: string): Promise<void> {
  await requireAuth();
  const projectId = idSchema.parse(id);
  await db.project.update({ where: { id: projectId }, data: { deletedAt: null } });
  revalidateAll();
}

/** Permanent delete (only offered for projects already in the deleted list). */
export async function purgeProject(id: string): Promise<void> {
  await requireAuth();
  const projectId = idSchema.parse(id);
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: { not: null } } });
  if (!project) return;
  await db.project.delete({ where: { id: projectId } });
  await removeProjectFiles(projectId);
  revalidateAll();
}
