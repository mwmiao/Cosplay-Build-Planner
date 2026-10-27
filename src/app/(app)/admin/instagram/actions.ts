"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addManualPost, checkSource, checkSources, cleanUsername, testFeed, type TestFeedResult } from "@/lib/instagram/monitor";
import { PROVIDERS } from "@/lib/instagram/providers";
import { type FormState, idSchema } from "@/lib/validation";

const SOURCE_TYPES = ["organiser", "convention", "venue", "photographer", "community", "other"] as const;

function revalidate() {
  revalidatePath("/admin", "layout");
  revalidatePath("/events");
}

const blank = (x: unknown) => (typeof x === "string" && x.trim() === "" ? undefined : typeof x === "string" ? x.trim() : x);
const httpUrl = (msg: string) => z.preprocess(blank, z.string().max(2000).url(msg).refine((u) => /^https?:\/\//i.test(u), msg).optional());

function parseId(id: string) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Sources

export async function saveSource(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const { t } = getI18n();
  const S = t.instagram;
  const username = cleanUsername(String(formData.get("username") ?? ""));
  if (!username) return { ok: false, errors: { username: [S.usernameInvalid] } };
  const parsed = z
    .object({
      displayName: z.preprocess(blank, z.string().max(120).optional()),
      sourceType: z.enum(SOURCE_TYPES).catch("organiser"),
      feedUrl: httpUrl(t.validation.url),
      providerName: z.string().refine((p) => p in PROVIDERS && (p !== "mock" || process.env.NODE_ENV !== "production")).catch("rss-bridge"),
      organiserId: z.preprocess(blank, idSchema.optional()),
      active: z.preprocess((x) => x === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: t.common.fixFields, errors: parsed.error.flatten().fieldErrors };
  const clash = await db.instagramSource.findFirst({ where: { username, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { ok: false, errors: { username: [S.usernameTaken] } };
  const organiserId = parsed.data.organiserId
    ? ((await db.organiser.findUnique({ where: { id: parsed.data.organiserId }, select: { id: true } }))?.id ?? null)
    : null;
  const data = {
    username,
    displayName: parsed.data.displayName ?? null,
    sourceType: parsed.data.sourceType,
    feedUrl: parsed.data.feedUrl ?? null,
    providerName: parsed.data.providerName,
    organiserId,
    active: parsed.data.active,
  };
  if (id) {
    // Changing the account or feed starts the schedule afresh.
    await db.instagramSource.update({ where: { id: parseId(id) }, data: { ...data, nextCheckAt: null, consecutiveFailures: 0 } });
  } else {
    await db.instagramSource.create({ data });
  }
  revalidate();
  redirect("/admin/organisers#instagram");
}

export async function deleteSource(id: string): Promise<void> {
  await requireAdmin();
  // Stored posts and the events/updates they produced are kept (sourceId becomes empty).
  await db.instagramSource.deleteMany({ where: { id: parseId(id) } });
  revalidate();
  redirect("/admin/organisers#instagram");
}

export async function checkSourceNow(id: string): Promise<void> {
  await requireAdmin();
  await checkSource(parseId(id), { fresh: true });
  revalidate();
}

export async function checkAllSources(): Promise<void> {
  await requireAdmin();
  await checkSources({ force: true });
  revalidate();
}

/** Fetches and validates the feed only: never stores posts or creates events/notifications. */
export async function testSourceFeed(id: string, _prev: TestFeedResult | null): Promise<TestFeedResult> {
  await requireAdmin();
  return testFeed(parseId(id));
}

export type ManualPostState = FormState & { outcome?: string };

export async function addManualPostAction(_prev: ManualPostState, formData: FormData): Promise<ManualPostState> {
  await requireAdmin();
  const { t } = getI18n();
  const S = t.instagram;
  const parsed = z
    .object({
      sourceId: z.preprocess(blank, idSchema.optional()),
      permalink: z.string().trim().url(S.permalinkInvalid).refine((u) => /^https:\/\/(www\.)?instagram\.com\//i.test(u), S.permalinkInvalid),
      caption: z.string().trim().min(3, S.captionRequired).max(10_000),
      publishedAt: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
      imageUrl: httpUrl(t.validation.url),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: t.common.fixFields, errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const outcome = await addManualPost({
    sourceId: d.sourceId ?? null,
    permalink: d.permalink,
    caption: d.caption,
    publishedAt: d.publishedAt ? new Date(`${d.publishedAt}T12:00:00.000Z`) : null,
    imageUrl: d.imageUrl ?? null,
  });
  revalidate();
  return { ok: outcome !== "duplicate", outcome, message: (S.manualOutcome as Record<string, string>)[outcome] ?? outcome };
}

// ---------------------------------------------------------------------------
// Review of detected posts

async function post(id: string) {
  const p = await db.instagramPost.findUnique({ where: { id: parseId(id) }, include: { event: true } });
  if (!p) notFound();
  return p;
}

/** Approve: the post's pending event becomes public. */
export async function approvePost(id: string): Promise<void> {
  await requireAdmin();
  const p = await post(id);
  if (p.event && p.event.status === "pending_review") {
    await db.event.update({ where: { id: p.event.id }, data: { status: "approved" } });
  }
  await db.instagramPost.update({ where: { id: p.id }, data: { reviewStatus: "approved" } });
  revalidate();
}

/** Reject: the event is hidden for good (and similar posts later are ignored). */
export async function rejectPost(id: string): Promise<void> {
  await requireAdmin();
  const p = await post(id);
  if (p.event && p.event.status === "pending_review") {
    await db.event.update({ where: { id: p.event.id }, data: { status: "rejected" } });
  }
  await db.instagramPost.update({ where: { id: p.id }, data: { reviewStatus: "rejected" } });
  revalidate();
}

/** Not an event: same as reject, but recorded as a detection mistake. */
export async function markNotEvent(id: string): Promise<void> {
  await requireAdmin();
  const p = await post(id);
  if (p.event && p.event.status === "pending_review") {
    await db.event.update({ where: { id: p.event.id }, data: { status: "rejected" } });
  }
  await db.instagramPost.update({ where: { id: p.id }, data: { reviewStatus: "not_event" } });
  revalidate();
}

/** Apply or dismiss the changes a post proposed for an existing event. */
export async function resolveEventUpdate(id: string, apply: boolean): Promise<void> {
  await requireAdmin();
  const update = await db.eventUpdate.findUnique({ where: { id: parseId(id) } });
  if (!update || update.status !== "pending_review") return revalidate();
  if (apply) {
    let changes: Record<string, [unknown, unknown]> = {};
    try {
      changes = JSON.parse(update.changes);
    } catch {
      changes = {};
    }
    const allowed = ["startDate", "endDate", "time", "venue", "address", "city", "tickets"];
    const data: Record<string, unknown> = {};
    for (const [field, [, next]] of Object.entries(changes)) {
      if (!allowed.includes(field)) continue;
      data[field] = (field === "startDate" || field === "endDate") && typeof next === "string" ? new Date(`${next}T00:00:00.000Z`) : next;
    }
    await db.event.update({ where: { id: update.eventId }, data: { ...data, capturedAt: new Date() } });
  }
  await db.$transaction([
    db.eventUpdate.update({ where: { id: update.id }, data: { status: apply ? "applied" : "dismissed" } }),
    db.instagramPost.update({ where: { id: update.postId }, data: { reviewStatus: apply ? "approved" : "rejected" } }),
  ]);
  revalidate();
}

export async function markNotificationsRead(): Promise<void> {
  await requireAdmin();
  await db.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  revalidate();
}
