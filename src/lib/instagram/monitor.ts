import "server-only";
import type { InstagramPost, InstagramSource } from "@prisma/client";
import { db } from "../db";
import { safeHttpUrl } from "../safeUrl";
import { today } from "../events";
import { diffFields } from "../events/diff";
import { nameSimilarity, normaliseAddress, normaliseCity, normaliseName, normaliseVenue } from "../events/names";
import { type Detection, detectEvent } from "./detect";
import { getProvider } from "./providers";
import { FeedError, type InstagramPostInput } from "./types";

// Instagram monitor: for each active source, fetch recent posts through its
// provider, store new ones (duplicates skipped by post id, then permalink),
// detect events, and queue them for admin review with a notification.
// Nothing becomes public here: events are created as "pending_review" and
// only an admin's approval publishes them.

const MINUTE = 60_000;
const MAX_BACKOFF = 24 * 60 * MINUTE;
const LOCK_MS = 5 * MINUTE;

export function monitorEnabled(): boolean {
  return (process.env.INSTAGRAM_MONITOR_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export function pollIntervalMinutes(): number {
  const n = Number(process.env.INSTAGRAM_POLL_INTERVAL_MINUTES ?? "30");
  return Number.isFinite(n) && n >= 5 ? n : 30;
}

/** Normalises a username: no "@", no profile URL, lowercase. Null if it isn't a valid username. */
export function cleanUsername(input: string): string | null {
  const u = input
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

export type CheckResult = { ok: boolean; skipped?: boolean; newPosts: number; events: number; updates: number; error?: string };

/** Stores a post unless it's already known (same source + post id, or same permalink). Returns null for duplicates. */
export async function storePost(sourceId: string | null, input: InstagramPostInput, provider: string): Promise<InstagramPost | null> {
  if (input.externalId && sourceId) {
    const byId = await db.instagramPost.findUnique({ where: { sourceId_externalId: { sourceId, externalId: input.externalId } } });
    if (byId) return null;
  }
  if (input.permalink) {
    const byLink = await db.instagramPost.findFirst({ where: { permalink: input.permalink }, select: { id: true } });
    if (byLink) return null;
  }
  try {
    return await db.instagramPost.create({
      data: {
        sourceId,
        externalId: input.externalId?.slice(0, 300) ?? null,
        permalink: safeHttpUrl(input.permalink)?.slice(0, 2000) ?? null,
        title: input.title?.slice(0, 300) ?? null,
        caption: input.caption?.slice(0, 10_000) ?? null,
        publishedAt: input.publishedAt,
        imageUrl: safeHttpUrl(input.imageUrl)?.slice(0, 2000) ?? null,
        raw: input.raw,
        provider,
        reviewStatus: "pending_review",
      },
    });
  } catch {
    return null; // a concurrent run stored it first (unique constraint)
  }
}

const DAY = 86_400_000;
const asDay = (s: string) => new Date(`${s}T00:00:00.000Z`);

function preview(text: string | null): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

async function notify(post: InstagramPost, kind: "new_event" | "event_update" | "possible_event", title: string, detection: Detection, username: string | null) {
  const f = detection.fields;
  await db.adminNotification
    .create({
      data: {
        kind,
        postId: post.id,
        title: title.slice(0, 200),
        detail: JSON.stringify({
          date: f.start ? (f.end ? `${f.start} – ${f.end}` : f.start) : null,
          location: [f.venue, f.address, f.city].filter(Boolean).join(", ") || null,
          username,
          permalink: post.permalink,
          preview: preview(post.caption),
        }),
      },
    })
    .catch(() => undefined); // unique per post: never notify twice
}

/**
 * Detection and review queueing for one stored post:
 * - not event-related → "ignored" (kept, no notification);
 * - matches an existing event (same organiser or similar name, dates within
 *   2 weeks) → an EventUpdate with the changes (or nothing if no change); a
 *   match with a rejected event is ignored so it doesn't come back;
 * - otherwise, with a date → a new event, "pending_review";
 * - without a date but some signals → "Possible event", for review.
 */
export async function processPost(post: InstagramPost, source: Pick<InstagramSource, "username" | "displayName" | "organiserId"> | null): Promise<"event" | "update" | "possible" | "ignored"> {
  const text = [post.title, post.caption].filter(Boolean).join("\n");
  const detection = detectEvent(post.caption || post.title || "", post.publishedAt ?? post.createdAt);
  const f = detection.fields;
  const reason = detection.reasons.join("; ") || "no event signals";
  await db.instagramPost.update({
    where: { id: post.id },
    data: { confidence: detection.confidence, reason, extracted: JSON.stringify(f) },
  });
  if (detection.level === "none" || !text.trim()) {
    await db.instagramPost.update({ where: { id: post.id }, data: { reviewStatus: "ignored" } });
    return "ignored";
  }
  const username = source?.username ?? null;
  const name = (f.name && f.name.length >= 3 ? f.name : (source?.displayName ?? username ?? "Instagram post")).slice(0, 120);

  if (f.start) {
    const start = asDay(f.start);
    if ((f.end ? asDay(f.end) : start).getTime() < today().getTime()) {
      await db.instagramPost.update({ where: { id: post.id }, data: { reviewStatus: "ignored", reason: `${reason}; already over` } });
      return "ignored";
    }
    const candidates = await db.event.findMany({
      where: { startDate: { gte: new Date(start.getTime() - 14 * DAY), lte: new Date(start.getTime() + 14 * DAY) } },
    });
    const match = candidates.find(
      (e) => (source?.organiserId && e.organiserId === source.organiserId) || nameSimilarity(e.name, name) >= 0.75,
    );
    if (match) {
      if (match.status === "rejected") {
        await db.instagramPost.update({ where: { id: post.id }, data: { reviewStatus: "ignored", eventId: match.id, reason: `${reason}; matches a rejected event` } });
        return "ignored";
      }
      const proposed: Record<string, unknown> = { startDate: start };
      if (f.end) proposed.endDate = asDay(f.end);
      if (f.time) proposed.time = f.time;
      if (f.venue) proposed.venue = normaliseVenue(f.venue);
      if (f.address) proposed.address = normaliseAddress(f.address);
      if (f.city) proposed.city = normaliseCity(f.city);
      if (f.tickets) proposed.tickets = f.tickets;
      // Ignore differences of punctuation/case only ("Bombarda, 285" vs "Bombarda 285").
      const changes = Object.fromEntries(
        Object.entries(diffFields(match, proposed)).filter(
          ([, [before, after]]) => typeof before !== "string" || typeof after !== "string" || normaliseName(before) !== normaliseName(after),
        ),
      );
      if (!Object.keys(changes).length) {
        await db.instagramPost.update({ where: { id: post.id }, data: { reviewStatus: "ignored", eventId: match.id, reason: `${reason}; same details as an existing event` } });
        return "ignored";
      }
      await db.eventUpdate.create({ data: { eventId: match.id, postId: post.id, changes: JSON.stringify(changes) } });
      await db.instagramPost.update({ where: { id: post.id }, data: { reviewStatus: "update", eventId: match.id } });
      await notify(post, "event_update", match.name, detection, username);
      return "update";
    }
    const organiser = source?.organiserId ? await db.organiser.findUnique({ where: { id: source.organiserId } }) : null;
    const hasPlace = !!(f.venue || f.address);
    const event = await db.event.create({
      data: {
        name,
        startDate: start,
        endDate: f.end ? asDay(f.end) : null,
        time: f.time ?? null,
        city: normaliseCity(f.city ?? organiser?.city ?? "") || "—",
        venue: f.venue ? normaliseVenue(f.venue) : hasPlace ? null : (organiser?.usualVenue ?? null),
        address: f.address ? normaliseAddress(f.address) : hasPlace ? null : (organiser?.usualAddress ?? null),
        tickets: f.tickets ?? null,
        url: f.ticketUrl ?? null,
        eventType: organiser?.eventType ?? "other",
        status: "pending_review",
        source: "instagram",
        sourceUrl: post.permalink,
        posterUrl: post.imageUrl,
        capturedAt: new Date(),
        confidence: detection.confidence,
        confidenceNote: reason,
        externalKey: `instagram:${post.id}`,
        organiserId: source?.organiserId ?? null,
      },
    });
    await db.instagramPost.update({ where: { id: post.id }, data: { eventId: event.id } });
    await notify(post, "new_event", name, detection, username);
    return "event";
  }

  // Event-like but no date: a possible event for the admin to judge.
  await notify(post, "possible_event", name, detection, username);
  return "possible";
}

/** Checks one source: fetch, store new posts, detect events. Never runs twice at once for a source. */
export async function checkSource(sourceId: string, { fresh = false }: { fresh?: boolean } = {}): Promise<CheckResult> {
  const now = new Date();
  const claimed = await db.instagramSource.updateMany({
    where: { id: sourceId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  if (claimed.count !== 1) return { ok: false, skipped: true, newPosts: 0, events: 0, updates: 0, error: "Already being checked" };
  const source = await db.instagramSource.findUniqueOrThrow({ where: { id: sourceId } });
  const provider = getProvider(source.providerName);
  const result: CheckResult = { ok: false, newPosts: 0, events: 0, updates: 0 };
  try {
    const { posts } = await provider.fetchRecentPosts({ username: source.username, feedUrl: source.feedUrl }, { fresh });
    const sorted = [...posts].sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
    for (const input of sorted) {
      const stored = await storePost(source.id, input, provider.name);
      if (!stored) continue;
      result.newPosts += 1;
      const outcome = await processPost(stored, source);
      if (outcome === "event") result.events += 1;
      if (outcome === "update") result.updates += 1;
    }
    const latest = sorted[sorted.length - 1];
    result.ok = true;
    await db.instagramSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastSuccessfulCheckAt: new Date(),
        lastError: null,
        consecutiveFailures: 0,
        nextCheckAt: new Date(Date.now() + pollIntervalMinutes() * MINUTE),
        latestSeenPostId: latest ? (latest.externalId ?? latest.permalink ?? source.latestSeenPostId) : source.latestSeenPostId,
        lockedUntil: null,
      },
    });
  } catch (err) {
    const message = err instanceof FeedError ? err.message : "Unexpected error while reading the feed";
    if (!(err instanceof FeedError)) console.error("Instagram check failed", err);
    const failures = source.consecutiveFailures + 1;
    // Back off: interval × 2^(failures−1), at most a day. latestSeenPostId is kept.
    const delay = Math.min(MAX_BACKOFF, pollIntervalMinutes() * MINUTE * 2 ** (failures - 1));
    console.warn(`[instagram] provider=${provider.name} user=${source.username} status=error failures=${failures} error=${message}`);
    await db.instagramSource.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), lastError: message.slice(0, 500), consecutiveFailures: failures, nextCheckAt: new Date(Date.now() + delay), lockedUntil: null },
    });
    result.error = message;
    return result;
  }
  console.log(`[instagram] provider=${provider.name} user=${source.username} status=ok new=${result.newPosts} events=${result.events} updates=${result.updates}`);
  return result;
}

/** Checks every active source whose next check is due (or all of them with force). One at a time, gently paced. */
export async function checkSources({ force = false }: { force?: boolean } = {}): Promise<CheckResult[]> {
  // force = an admin's "Check all": every active source, fresh (no cache).
  const now = new Date();
  const sources = await db.instagramSource.findMany({
    where: { active: true, ...(force ? {} : { OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] }) },
    orderBy: { username: "asc" },
  });
  const results: CheckResult[] = [];
  for (const [i, s] of sources.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    results.push(await checkSource(s.id, { fresh: force }));
  }
  return results;
}

export type TestFeedResult = { ok: boolean; feedUrl: string | null; count: number; latest: string | null; error?: string };

/** Fetches and validates a source's feed without storing anything (no posts, events or notifications). */
export async function testFeed(sourceId: string): Promise<TestFeedResult> {
  const source = await db.instagramSource.findUniqueOrThrow({ where: { id: sourceId } });
  const provider = getProvider(source.providerName);
  const feedUrl = source.feedUrl || provider.buildFeedUrl(source.username);
  try {
    const { posts } = await provider.fetchRecentPosts({ username: source.username, feedUrl: source.feedUrl }, { fresh: true });
    const latest = posts.map((p) => p.publishedAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
    return { ok: true, feedUrl, count: posts.length, latest: latest ? new Date(latest).toISOString() : null };
  } catch (err) {
    return { ok: false, feedUrl, count: 0, latest: null, error: err instanceof FeedError ? err.message : "Unexpected error" };
  }
}

/** Manual fallback: an admin pastes a post; it goes through the same storage, detection and review. */
export async function addManualPost(input: {
  sourceId: string | null;
  permalink: string;
  caption: string;
  publishedAt: Date | null;
  imageUrl: string | null;
}): Promise<"event" | "update" | "possible" | "ignored" | "duplicate"> {
  const source = input.sourceId ? await db.instagramSource.findUnique({ where: { id: input.sourceId } }) : null;
  const shortcode = /instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i.exec(input.permalink)?.[1] ?? null;
  const stored = await storePost(
    source?.id ?? null,
    { externalId: shortcode, permalink: input.permalink, title: null, caption: input.caption, publishedAt: input.publishedAt, imageUrl: input.imageUrl, raw: null },
    "manual",
  );
  if (!stored) return "duplicate";
  return processPost(stored, source);
}
