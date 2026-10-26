"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, errorState, formToObject, idSchema } from "@/lib/validation";

function eventSchema(t: ReturnType<typeof getI18n>["t"]) {
  const v = t.validation;
  const E = t.events;
  const blank = (x: unknown) => (typeof x === "string" && x.trim() === "" ? undefined : typeof x === "string" ? x.trim() : x);
  const day = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, v.date)
    .transform((s) => new Date(`${s}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), v.invalidDate);
  const optional = (max: number) => z.preprocess(blank, z.string().max(max, v.tooLong(max)).optional());
  return z
    .object({
      name: z.string().trim().min(1, v.required(E.name)).max(120, v.tooLong(120)),
      startDate: z.preprocess(blank, day.optional()).refine((d) => d !== undefined, v.required(E.startDate)),
      endDate: z.preprocess(blank, day.optional()),
      city: z.string().trim().min(1, v.required(E.city)).max(80, v.tooLong(80)),
      venue: optional(120),
      url: z.preprocess(
        blank,
        z.string().max(2000).url(v.url).refine((u) => /^https?:\/\//i.test(u), v.urlScheme).optional(),
      ),
      notes: optional(500),
    })
    .superRefine((d, ctx) => {
      if (d.startDate && d.endDate && d.endDate < d.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: E.endBeforeStart });
      }
    });
}

function data(d: z.infer<ReturnType<typeof eventSchema>>) {
  return {
    name: d.name,
    startDate: d.startDate as Date,
    endDate: d.endDate ?? null,
    city: d.city,
    venue: d.venue ?? null,
    url: d.url ?? null,
    notes: d.notes ?? null,
  };
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  await db.event.create({ data: { ...data(parsed.data), createdBy: admin.id } });
  revalidatePath("/events");
  redirect("/events");
}

export async function updateEvent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const result = await db.event.updateMany({ where: { id: eventId.data }, data: data(parsed.data) });
  if (result.count !== 1) notFound();
  revalidatePath("/events");
  redirect("/events");
}

export async function deleteEvent(id: string): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  await db.event.deleteMany({ where: { id: eventId.data } });
  revalidatePath("/events");
  redirect("/events");
}
