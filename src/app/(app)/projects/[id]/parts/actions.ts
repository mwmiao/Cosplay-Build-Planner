"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncShoppingItemForPart } from "@/lib/shopping";
import { type FormState, errorState, formToObject, idSchema, partSchema } from "@/lib/validation";

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/shopping");
}

async function liveProject(projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw new Error("Project not found");
  return project;
}

export async function createPart(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  await liveProject(pid);
  const parsed = partSchema.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error);

  await db.$transaction(async (tx) => {
    const part = await tx.buildPart.create({
      data: {
        ...parsed.data,
        projectId: pid,
        completedAt: parsed.data.status === "done" ? new Date() : null,
      },
    });
    await syncShoppingItemForPart(tx, part);
  });
  revalidate(pid);

  if (formData.get("intent") === "add-another") {
    return { ok: true, message: `Added “${parsed.data.name}”. Add another?` };
  }
  redirect(`/projects/${pid}#parts`);
}

export async function updatePart(
  projectId: string,
  partId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(partId);
  const parsed = partSchema.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error);

  const d = parsed.data;
  await db.$transaction(async (tx) => {
    const before = await tx.buildPart.findFirstOrThrow({ where: { id, projectId: pid, deletedAt: null } });
    const part = await tx.buildPart.update({
      where: { id },
      data: {
        name: d.name,
        category: d.category,
        status: d.status,
        estimatedCostCents: d.estimatedCostCents ?? null,
        actualCostCents: d.actualCostCents ?? null,
        quantity: d.quantity,
        supplier: d.supplier ?? null,
        url: d.url ?? null,
        notes: d.notes ?? null,
        completedAt: d.status === "done" ? (before.completedAt ?? new Date()) : null,
      },
    });
    await syncShoppingItemForPart(tx, part);
  });
  revalidate(pid);
  redirect(`/projects/${pid}#parts`);
}

/** Quick toggle from the parts list: done ↔ building (or back to its earlier status). */
export async function togglePartDone(projectId: string, partId: string): Promise<void> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(partId);
  await db.$transaction(async (tx) => {
    const before = await tx.buildPart.findFirstOrThrow({ where: { id, projectId: pid, deletedAt: null } });
    const done = before.status !== "done";
    const part = await tx.buildPart.update({
      where: { id },
      data: { status: done ? "done" : "building", completedAt: done ? new Date() : null },
    });
    await syncShoppingItemForPart(tx, part);
  });
  revalidate(pid);
}

export async function deletePart(projectId: string, partId: string): Promise<void> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const id = idSchema.parse(partId);
  await db.$transaction(async (tx) => {
    const part = await tx.buildPart.update({
      where: { id, projectId: pid },
      data: { deletedAt: new Date() },
    });
    await syncShoppingItemForPart(tx, part);
  });
  revalidate(pid);
  redirect(`/projects/${pid}#parts`);
}
