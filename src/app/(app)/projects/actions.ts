"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GUEST_MAX_PROJECTS, guestUsage } from "@/lib/guest";
import { getDefaultCurrency } from "@/lib/settings";
import { removePublicationFolder } from "@/lib/community/images";
import { removeProjectFiles } from "@/lib/uploads";
import {
  type FormState,
  errorState,
  formToObject,
  idSchema,
  schemas,
} from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/projects", "layout");
  revalidatePath("/shopping");
  revalidatePath("/settings");
}

/** Every write below is filtered by the session user's id; another user's project counts as not found. */
function expectOne(result: { count: number }) {
  if (result.count !== 1) notFound();
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = getI18n();
  const parsed = schemas(t).project.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  if (user.isGuest && (await guestUsage(user.id)).projects >= GUEST_MAX_PROJECTS) {
    return { ok: false, message: t.guest.projectLimit(GUEST_MAX_PROJECTS) };
  }

  // New projects are always private and owned by the session user.
  const project = await db.project.create({ data: { ...parsed.data, ownerId: user.id } });
  revalidateAll();
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const projectId = idSchema.parse(id);
  const { t } = getI18n();
  const parsed = schemas(t).project.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);

  const current = await db.project.findFirst({ where: { id: projectId, ownerId: user.id, deletedAt: null } });
  if (!current) notFound();

  // Paid amounts are stored in the base currency at their payment-date rate, so
  // the base can't change once parts in a specific currency have been paid.
  const d = parsed.data;
  const base = current.currency ?? (await getDefaultCurrency(user.id));
  if (d.currency !== base) {
    const converted = await db.buildPart.count({
      where: { projectId, deletedAt: null, paidAt: { not: null }, currency: { not: null } },
    });
    if (converted > 0) {
      const msg = t.projectForm.currencyChangeRefused(converted, base);
      return { ok: false, message: msg, errors: { currency: [msg] } };
    }
  }

  // Optional fields left blank are cleared rather than kept.
  expectOne(
    await db.project.updateMany({
      where: { id: projectId, ownerId: user.id, deletedAt: null },
      data: {
        characterName: d.characterName,
        series: d.series ?? null,
        conventionName: d.conventionName ?? null,
        startDate: d.startDate ?? null,
        deadline: d.deadline ?? null,
        status: d.status,
        currency: d.currency,
        budgetCents: d.budgetCents ?? null,
        notes: d.notes ?? null,
      },
    }),
  );
  revalidateAll();
  redirect(`/projects/${projectId}`);
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const user = await requireUser();
  const projectId = idSchema.parse(id);
  expectOne(
    await db.project.updateMany({
      where: { id: projectId, ownerId: user.id, deletedAt: null },
      data: { archivedAt: archived ? new Date() : null },
    }),
  );
  revalidateAll();
  redirect(archived ? "/projects" : `/projects/${projectId}`);
}

/** Soft delete: the project moves to Settings → Deleted projects, where it can be restored. */
export async function deleteProject(id: string): Promise<void> {
  const user = await requireUser();
  const projectId = idSchema.parse(id);
  expectOne(
    await db.project.updateMany({
      where: { id: projectId, ownerId: user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  );
  revalidateAll();
  redirect("/projects");
}

export async function restoreProject(id: string): Promise<void> {
  const user = await requireUser();
  const projectId = idSchema.parse(id);
  expectOne(
    await db.project.updateMany({
      where: { id: projectId, ownerId: user.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    }),
  );
  revalidateAll();
}

/** Permanent delete (only offered for the user's projects already in the deleted list). */
export async function purgeProject(id: string): Promise<void> {
  const user = await requireUser();
  const projectId = idSchema.parse(id);
  const publication = await db.publication.findFirst({ where: { projectId, ownerId: user.id }, select: { id: true } });
  const result = await db.project.deleteMany({
    where: { id: projectId, ownerId: user.id, deletedAt: { not: null } },
  });
  expectOne(result);
  await removeProjectFiles(projectId);
  // The publication row went with the project (cascade); remove its public copies too.
  if (publication) await removePublicationFolder(publication.id);
  revalidateAll();
}
