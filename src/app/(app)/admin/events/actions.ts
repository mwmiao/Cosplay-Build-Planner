"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAccount, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncEvents } from "@/lib/events/sync";
import { rateLimit } from "@/lib/rateLimit";
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
  const url = z.preprocess(
    blank,
    z.string().max(2000).url(v.url).refine((u) => /^https?:\/\//i.test(u), v.urlScheme).optional(),
  );
  return z
    .object({
      name: z.string().trim().min(1, v.required(E.name)).max(120, v.tooLong(120)),
      startDate: z.preprocess(blank, day.optional()).refine((d) => d !== undefined, v.required(E.startDate)),
      endDate: z.preprocess(blank, day.optional()),
      city: z.string().trim().min(1, v.required(E.city)).max(80, v.tooLong(80)),
      venue: optional(120),
      address: optional(200),
      mapUrl: url,
      url,
      sourceUrl: url,
      notes: optional(500),
    })
    .superRefine((d, ctx) => {
      if (d.startDate && d.endDate && d.endDate < d.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: E.endBeforeStart });
      }
    });
}

type EventInput = z.infer<ReturnType<typeof eventSchema>>;

function data(d: EventInput) {
  return {
    name: d.name,
    startDate: d.startDate as Date,
    endDate: d.endDate ?? null,
    city: d.city,
    venue: d.venue ?? null,
    address: d.address ?? null,
    mapUrl: d.mapUrl ?? null,
    url: d.url ?? null,
    notes: d.notes ?? null,
  };
}

function revalidate() {
  revalidatePath("/events");
  revalidatePath("/admin/events");
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  await db.event.create({ data: { ...data(parsed.data), status: "approved", source: "admin", createdBy: admin.id } });
  revalidate();
  redirect("/events");
}

/** Saving an event as admin also approves it (used to fix a suggestion before publishing it). */
export async function updateEvent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const result = await db.event.updateMany({
    where: { id: eventId.data },
    data: { ...data(parsed.data), status: "approved", sourceUrl: parsed.data.sourceUrl ?? null },
  });
  if (result.count !== 1) notFound();
  revalidate();
  redirect("/events");
}

export async function deleteEvent(id: string): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  await db.event.deleteMany({ where: { id: eventId.data } });
  revalidate();
  redirect("/events");
}

/** Anyone with an account can suggest an event; it waits for an admin. */
export async function suggestEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount();
  const { t } = getI18n();
  if (!(await rateLimit(`event-suggest:${user.id}`, 10, 24 * 60 * 60))) return { ok: false, message: t.events.tooManySuggestions };
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  await db.event.create({
    data: {
      ...data(parsed.data),
      // A suggestion can't set an exact map link; the admin can add one.
      mapUrl: null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      status: "pending",
      source: "user",
      createdBy: user.id,
    },
  });
  revalidate();
  redirect("/events?suggested=1");
}

/** Approve or reject a queued event (rejected ones are kept so the daily check doesn't re-add them). */
export async function reviewEvent(id: string, approve: boolean): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  await db.event.updateMany({ where: { id: eventId.data, status: "pending" }, data: { status: approve ? "approved" : "rejected" } });
  revalidate();
}

export async function runEventSync(): Promise<void> {
  await requireAdmin();
  await syncEvents();
  revalidate();
}
