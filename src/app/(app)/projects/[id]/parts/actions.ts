"use server";

import type { BuildPart, Project } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Dict } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UNPAID, type PaymentFields, convertPayment } from "@/lib/payments";
import { RateUnavailableError } from "@/lib/rates";
import { getDefaultCurrency } from "@/lib/settings";
import { syncShoppingItemForPart } from "@/lib/shopping";
import {
  type FormState,
  type PartInput,
  errorState,
  formToObject,
  idSchema,
  schemas,
} from "@/lib/validation";

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

/**
 * Works out the stored payment fields. Returns a FormState error when the rate
 * for the payment date can't be found, so the user can type the charged amount.
 */
async function paymentFor(
  d: PartInput,
  project: Project,
  previous: BuildPart | null,
  t: Dict,
): Promise<{ fields: PaymentFields; base: string } | FormState> {
  const base = project.currency ?? (await getDefaultCurrency());
  if (!d.paid || !d.paidAt || d.actualCostCents === undefined) return { fields: UNPAID, base };
  try {
    const fields = await convertPayment(
      {
        currency: d.currency,
        actualCostCents: d.actualCostCents,
        quantity: d.quantity,
        paidAt: d.paidAt,
        chargedBaseCents: d.chargedBaseCents,
      },
      base,
      previous,
    );
    return { fields, base };
  } catch (err) {
    if (err instanceof RateUnavailableError) {
      const msg = t.payment.rateUnavailable(err.from, err.to, err.date);
      return { ok: false, message: msg, errors: { chargedBaseCents: [msg] } };
    }
    console.error("Payment conversion failed", err);
    return {
      ok: false,
      message: t.payment.lookupFailed(base),
      errors: { chargedBaseCents: [t.payment.lookupFailedField] },
    };
  }
}

function partData(d: PartInput) {
  return {
    name: d.name,
    category: d.category,
    status: d.status,
    currency: d.currency,
    estimatedCostCents: d.estimatedCostCents ?? null,
    actualCostCents: d.actualCostCents ?? null,
    quantity: d.quantity,
    supplier: d.supplier ?? null,
    url: d.url ?? null,
    notes: d.notes ?? null,
  };
}

/** Pins the project's base currency once it holds converted payments. */
async function pinProjectCurrency(project: Project, base: string, payment: PaymentFields) {
  if (!project.currency && payment.paidAt) {
    await db.project.update({ where: { id: project.id }, data: { currency: base } });
  }
}

export async function createPart(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const pid = idSchema.parse(projectId);
  const project = await liveProject(pid);
  const { t } = getI18n();
  const parsed = schemas(t).part.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const payment = await paymentFor(parsed.data, project, null, t);
  if (!("fields" in payment)) return payment;

  await db.$transaction(async (tx) => {
    const part = await tx.buildPart.create({
      data: {
        ...partData(parsed.data),
        ...payment.fields,
        projectId: pid,
        completedAt: parsed.data.status === "done" ? new Date() : null,
      },
    });
    await syncShoppingItemForPart(tx, part);
  });
  await pinProjectCurrency(project, payment.base, payment.fields);
  revalidate(pid);

  if (formData.get("intent") === "add-another") {
    return { ok: true, message: t.partForm.added(parsed.data.name) };
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
  const project = await liveProject(pid);
  const { t } = getI18n();
  const parsed = schemas(t).part.safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const before = await db.buildPart.findFirstOrThrow({ where: { id, projectId: pid, deletedAt: null } });
  const payment = await paymentFor(parsed.data, project, before, t);
  if (!("fields" in payment)) return payment;

  const d = parsed.data;
  await db.$transaction(async (tx) => {
    const part = await tx.buildPart.update({
      where: { id },
      data: {
        ...partData(d),
        ...payment.fields,
        completedAt: d.status === "done" ? (before.completedAt ?? new Date()) : null,
      },
    });
    await syncShoppingItemForPart(tx, part);
  });
  await pinProjectCurrency(project, payment.base, payment.fields);
  revalidate(pid);
  redirect(`/projects/${pid}#parts`);
}

/** Quick toggle from the parts list: done ↔ building. Payment details are untouched. */
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
