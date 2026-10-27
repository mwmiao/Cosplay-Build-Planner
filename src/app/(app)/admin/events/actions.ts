"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAccount, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { normaliseAddress, normaliseCity, normaliseVenue } from "@/lib/events/names";
import { syncEvents } from "@/lib/events/sync";
import { ANNOUNCE_STATUSES, EVENT_TYPES } from "@/lib/events/types";
import { rateLimit } from "@/lib/rateLimit";
import { type FormState, errorState, formToObject, idSchema } from "@/lib/validation";


const blank = (x: unknown) => (typeof x === "string" && x.trim() === "" ? undefined : typeof x === "string" ? x.trim() : x);

function eventSchema(t: ReturnType<typeof getI18n>["t"]) {
  const v = t.validation;
  const E = t.events;
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
      time: optional(40),
      city: z.string().trim().min(1, v.required(E.city)).max(80, v.tooLong(80)),
      country: z.preprocess(blank, z.string().max(60).optional()),
      venue: optional(120),
      address: optional(200),
      mapUrl: url,
      url,
      sourceUrl: url,
      tickets: optional(200),
      notes: optional(500),
      eventType: z.preprocess(blank, z.enum(EVENT_TYPES).optional()),
      announceStatus: z.preprocess(blank, z.enum(ANNOUNCE_STATUSES).optional()),
      organiserId: z.preprocess(blank, idSchema.optional()),
    })
    .superRefine((d, ctx) => {
      if (d.startDate && d.endDate && d.endDate < d.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: E.endBeforeStart });
      }
      if (d.startDate && d.endDate && d.endDate.getTime() - d.startDate.getTime() > 14 * 86_400_000) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: E.rangeTooLong });
      }
    });
}

type EventInput = z.infer<ReturnType<typeof eventSchema>>;

/** Event fields from a form, with Portuguese addresses, venues and cities tidied. */
function data(d: EventInput) {
  return {
    name: d.name,
    startDate: d.startDate as Date,
    endDate: d.endDate ?? null,
    time: d.time ?? null,
    city: normaliseCity(d.city),
    country: d.country ?? "Portugal",
    venue: d.venue ? normaliseVenue(d.venue) : null,
    address: d.address ? normaliseAddress(d.address) : null,
    mapUrl: d.mapUrl ?? null,
    url: d.url ?? null,
    tickets: d.tickets ?? null,
    notes: d.notes ?? null,
    eventType: d.eventType ?? "other",
    announceStatus: d.announceStatus ?? "announced",
  };
}

function revalidate() {
  revalidatePath("/events");
  revalidatePath("/admin/events");
  revalidatePath("/admin/organisers");
}

async function organiserOrNull(id: string | undefined) {
  if (!id) return null;
  return (await db.organiser.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
}

/** Keeps Instagram posts in step with their event's review decision. */
async function syncPosts(eventId: string, reviewStatus: "approved" | "rejected") {
  await db.instagramPost.updateMany({ where: { eventId, reviewStatus: "pending_review" }, data: { reviewStatus } });
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  // "Create event from post": link the Instagram post the admin started from.
  const fromPost = idSchema.safeParse(formData.get("postId"));
  const post = fromPost.success ? await db.instagramPost.findUnique({ where: { id: fromPost.data }, select: { id: true } }) : null;
  const event = await db.event.create({
    data: {
      ...data(parsed.data),
      sourceUrl: parsed.data.sourceUrl ?? parsed.data.url ?? null,
      capturedAt: new Date(),
      organiserId: await organiserOrNull(parsed.data.organiserId),
      status: "approved",
      source: "admin",
      editedAt: new Date(),
      createdBy: admin.id,
    },
  });
  if (post) await db.instagramPost.update({ where: { id: post.id }, data: { eventId: event.id, reviewStatus: "approved" } });
  revalidate();
  redirect("/events");
}

/** Saving as admin approves the event and marks it edited (automatic refreshes then only suggest changes). */
export async function updateEvent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  const { t } = getI18n();
  const parsed = eventSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const result = await db.event.updateMany({
    where: { id: eventId.data },
    data: {
      ...data(parsed.data),
      sourceUrl: parsed.data.sourceUrl ?? null,
      organiserId: await organiserOrNull(parsed.data.organiserId),
      status: "approved",
      editedAt: new Date(),
    },
  });
  if (result.count !== 1) notFound();
  await syncPosts(eventId.data, "approved");
  revalidate();
  redirect("/events");
}

/**
 * Removes an event from Events. Built-in and automatically found events are
 * hidden rather than deleted, so they're never added again.
 */
export async function deleteEvent(id: string): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  const event = await db.event.findUnique({ where: { id: eventId.data }, select: { externalKey: true } });
  if (event?.externalKey) {
    await db.event.update({ where: { id: eventId.data }, data: { status: "rejected", pendingChange: null } });
    await syncPosts(eventId.data, "rejected");
  } else {
    await db.event.deleteMany({ where: { id: eventId.data } });
  }
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
      // A suggestion can't set an exact map link or organiser; the admin can.
      mapUrl: null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      capturedAt: new Date(),
      status: "pending_review",
      source: "user",
      createdBy: user.id,
    },
  });
  revalidate();
  redirect("/events?suggested=1");
}

/** Approve or reject an event waiting for review (rejected ones are kept so they aren't suggested again). */
export async function reviewEvent(id: string, approve: boolean): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  await db.event.updateMany({
    where: { id: eventId.data, status: "pending_review" },
    data: { status: approve ? "approved" : "rejected" },
  });
  await syncPosts(eventId.data, approve ? "approved" : "rejected");
  revalidate();
}

/** Applies or dismisses a change reported by a source (built-in list update, Instagram, listings). */
export async function resolveChange(id: string, apply: boolean): Promise<void> {
  await requireAdmin();
  const eventId = idSchema.safeParse(id);
  if (!eventId.success) notFound();
  const event = await db.event.findUnique({ where: { id: eventId.data } });
  if (!event?.pendingChange) return revalidate();
  if (apply) {
    let changes: Record<string, [unknown, unknown]> = {};
    try {
      changes = JSON.parse(event.pendingChange).changes ?? {};
    } catch {
      changes = {};
    }
    const allowed = ["name", "startDate", "endDate", "time", "city", "venue", "address", "mapUrl", "url", "notes", "eventType", "announceStatus", "sourceUrl"];
    const update: Record<string, unknown> = {};
    for (const [field, [, next]] of Object.entries(changes)) {
      if (!allowed.includes(field)) continue;
      update[field] = (field === "startDate" || field === "endDate") && typeof next === "string" ? new Date(`${next}T00:00:00.000Z`) : next;
    }
    await db.event.update({ where: { id: event.id }, data: { ...update, pendingChange: null, capturedAt: new Date() } });
  } else {
    await db.event.update({ where: { id: event.id }, data: { pendingChange: null } });
  }
  revalidate();
}

export async function runEventSync(): Promise<void> {
  await requireAdmin();
  await syncEvents();
  revalidate();
}

// ---------------------------------------------------------------------------
// Organisers (recurring events whose Instagram is checked daily)

function organiserSchema(t: ReturnType<typeof getI18n>["t"]) {
  const v = t.validation;
  const O = t.organisers;
  const optional = (max: number) => z.preprocess(blank, z.string().max(max, v.tooLong(max)).optional());
  return z.object({
    name: z.string().trim().min(1, v.required(O.name)).max(120, v.tooLong(120)),
    website: z.preprocess(blank, z.string().max(2000).url(v.url).refine((u) => /^https?:\/\//i.test(u), v.urlScheme).optional()),
    city: optional(80),
    usualVenue: optional(120),
    usualAddress: optional(200),
    eventType: z.preprocess(blank, z.enum(EVENT_TYPES).optional()),
    active: z.preprocess((x) => x === "on", z.boolean()),
  });
}

export async function saveOrganiser(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const { t } = getI18n();
  const parsed = organiserSchema(t).safeParse(formToObject(formData));
  if (!parsed.success) return errorState(parsed.error, t);
  const d = parsed.data;
  const values = {
    name: d.name,
    website: d.website ?? null,
    city: d.city ? normaliseCity(d.city) : null,
    usualVenue: d.usualVenue ? normaliseVenue(d.usualVenue) : null,
    usualAddress: d.usualAddress ? normaliseAddress(d.usualAddress) : null,
    eventType: d.eventType ?? "other",
    active: d.active,
  };
  if (id) {
    const organiserId = idSchema.safeParse(id);
    if (!organiserId.success) notFound();
    await db.organiser.update({ where: { id: organiserId.data }, data: values });
  } else {
    await db.organiser.create({ data: values });
  }
  revalidate();
  redirect("/admin/organisers");
}

export async function deleteOrganiser(id: string): Promise<void> {
  await requireAdmin();
  const organiserId = idSchema.safeParse(id);
  if (!organiserId.success) notFound();
  await db.organiser.deleteMany({ where: { id: organiserId.data } });
  revalidate();
  redirect("/admin/organisers");
}
