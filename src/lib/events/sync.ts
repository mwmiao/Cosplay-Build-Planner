import "server-only";
import pkg from "../../../package.json";
import { db } from "../db";
import { diffFields } from "./diff";
import { findSimilarEvents, today } from "./index";
import { InstagramError, fetchAccount, instagramConfig, postsToEvents } from "./instagram";
import { normaliseAddress, normaliseCity, normaliseVenue } from "./names";
import { type FoundEvent, parseJsonLd, parseViralAgenda, robotsAllows } from "./parse";

// Daily check for new events. Everything found goes to the admin's review
// queue (status "needs_review"); nothing is published without approval.
// - Instagram: organisers' business/creator accounts through Meta's official
//   API (see instagram.ts). Main source for small markets and meet-ups.
// - Public listings that allow it: robots.txt honoured, one request per page,
//   a clear User-Agent, size/time limits.
// Events already known are re-checked: if the source now says something
// different (date, venue…), the change is offered for review, never applied
// silently to an approved event.

type Source = { id: string; label: string; url: string; parse: (html: string, pageUrl: string) => FoundEvent[] };

export const SOURCES: Source[] = [
  { id: "viralagenda-cosplay", label: "Viral Agenda · cosplay", url: "https://www.viralagenda.com/pt/tags/cosplay", parse: parseViralAgenda },
  { id: "viralagenda-anime", label: "Viral Agenda · anime", url: "https://www.viralagenda.com/pt/tags/anime", parse: parseViralAgenda },
  { id: "xlgames", label: "XL Games", url: "https://xlgames.pt/", parse: parseJsonLd },
];

const USER_AGENT = `CosplayBuildPlanner/${pkg.version} (self-hosted events check; once a day)`;
const MAX_BYTES = 3 * 1024 * 1024;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("Page too large");
  const charset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export type SyncResult = { source: string; label: string; ok: boolean; found: number; added: number; changed?: number; error?: string };
export type SyncStatus = { at: string; results: SyncResult[] };

const STATUS_KEY = "events.sync";

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const row = await db.setting.findUnique({ where: { key: STATUS_KEY } });
  try {
    return row ? (JSON.parse(row.value) as SyncStatus) : null;
  } catch {
    return null;
  }
}

type Incoming = {
  key: string;
  name: string;
  start: string;
  end?: string;
  time?: string;
  city?: string;
  venue?: string;
  address?: string;
  tickets?: string;
  url?: string;
  posterUrl?: string;
  source: "sync" | "instagram";
  eventType?: string;
  organiserId?: string;
};

const DAY = 86_400_000;
const asDay = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Adds a new event for review, or reports a change to one already known. Returns what happened. */
export async function recordFound(e: Incoming): Promise<"added" | "changed" | "known" | "skipped"> {
  const start = asDay(e.start);
  const endRaw = e.end ? asDay(e.end) : null;
  if (Number.isNaN(start.getTime())) return "skipped";
  const end = endRaw && endRaw > start && endRaw.getTime() - start.getTime() <= 14 * DAY ? endRaw : null;
  if ((end ?? start).getTime() < today().getTime()) return "skipped";
  if (start.getTime() > today().getTime() + 3 * 365 * DAY) return "skipped"; // implausible
  const data = {
    name: e.name.slice(0, 120),
    startDate: start,
    endDate: end,
    time: e.time?.slice(0, 40) ?? null,
    city: normaliseCity(e.city ?? "").slice(0, 80) || "—",
    venue: e.venue ? normaliseVenue(e.venue).slice(0, 120) : null,
    address: e.address ? normaliseAddress(e.address).slice(0, 200) : null,
    tickets: e.tickets?.slice(0, 200) ?? null,
  };

  const existing = await db.event.findUnique({ where: { externalKey: e.key.slice(0, 300) } });
  if (existing) {
    if (existing.status === "rejected") return "known";
    const changes = diffFields(existing, { startDate: data.startDate, endDate: data.endDate, venue: data.venue, address: data.address, city: data.city, time: data.time });
    if (!Object.keys(changes).length) return "known";
    if (existing.status === "needs_review") {
      await db.event.update({ where: { id: existing.id }, data: { ...data, capturedAt: new Date() } });
      return "changed";
    }
    const pending = JSON.stringify({ source: e.source, url: e.url ?? null, changes });
    if (existing.pendingChange === pending) return "known";
    await db.event.update({ where: { id: existing.id }, data: { pendingChange: pending } });
    return "changed";
  }

  if ((await findSimilarEvents({ name: data.name, start, venue: data.venue, address: data.address })).length) return "known";
  await db.event.create({
    data: {
      ...data,
      url: e.url?.slice(0, 2000) ?? null,
      sourceUrl: e.url?.slice(0, 2000) ?? null,
      posterUrl: e.posterUrl?.slice(0, 2000) ?? null,
      capturedAt: new Date(),
      status: "needs_review",
      source: e.source,
      eventType: e.eventType ?? "other",
      externalKey: e.key.slice(0, 300),
      organiserId: e.organiserId ?? null,
    },
  });
  return "added";
}

async function syncInstagram(results: SyncResult[]) {
  const organisers = await db.organiser.findMany({ where: { active: true, instagram: { not: null } }, orderBy: { name: "asc" } });
  if (!organisers.length) return;
  if (!instagramConfig()) {
    results.push({ source: "instagram", label: "Instagram", ok: false, found: 0, added: 0, error: "notSetUp" });
    return;
  }
  for (const o of organisers) {
    const result: SyncResult = { source: `instagram:${o.instagram}`, label: `Instagram · @${o.instagram}`, ok: false, found: 0, added: 0, changed: 0 };
    try {
      const account = await fetchAccount(o.instagram!);
      const events = postsToEvents(account, o);
      result.found = events.length;
      for (const ev of events) {
        const outcome = await recordFound({ ...ev, name: ev.name ?? o.name, source: "instagram", eventType: o.eventType, organiserId: o.id });
        if (outcome === "added") result.added += 1;
        if (outcome === "changed") result.changed! += 1;
      }
      result.ok = true;
      await db.organiser.update({ where: { id: o.id }, data: { lastCheckedAt: new Date(), lastError: null } });
    } catch (err) {
      result.error = err instanceof InstagramError ? err.message : "Failed";
      await db.organiser.update({ where: { id: o.id }, data: { lastCheckedAt: new Date(), lastError: result.error } });
      results.push(result);
      if (err instanceof InstagramError && (err.kind === "token" || err.kind === "rateLimit")) break; // no point continuing
      continue;
    }
    results.push(result);
    await new Promise((r) => setTimeout(r, 1500)); // gentle pacing between accounts
  }
}

/** Checks every source once: Instagram organisers first, then public listings. */
export async function syncEvents(): Promise<SyncStatus> {
  const results: SyncResult[] = [];
  await syncInstagram(results);
  const robotsCache = new Map<string, string>();
  for (const source of SOURCES) {
    const result: SyncResult = { source: source.id, label: source.label, ok: false, found: 0, added: 0, changed: 0 };
    try {
      const u = new URL(source.url);
      if (!robotsCache.has(u.origin)) {
        robotsCache.set(u.origin, await fetchText(`${u.origin}/robots.txt`).catch(() => ""));
      }
      if (!robotsAllows(robotsCache.get(u.origin) ?? "", u.pathname)) throw new Error("Not allowed by robots.txt");
      const found = source.parse(await fetchText(source.url), source.url);
      result.found = found.length;
      for (const e of found) {
        const outcome = await recordFound({ ...e, source: "sync" });
        if (outcome === "added") result.added += 1;
        if (outcome === "changed") result.changed! += 1;
      }
      result.ok = true;
    } catch (err) {
      result.error = err instanceof Error ? err.message.slice(0, 200) : "Failed";
    }
    results.push(result);
  }
  const status: SyncStatus = { at: new Date().toISOString(), results };
  await db.setting.upsert({
    where: { key: STATUS_KEY },
    create: { key: STATUS_KEY, value: JSON.stringify(status) },
    update: { value: JSON.stringify(status) },
  });
  return status;
}
