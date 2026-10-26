import "server-only";
import pkg from "../../../package.json";
import { db } from "../db";
import { isKnownEvent, today } from "./index";
import { type FoundEvent, parseJsonLd, parseViralAgenda, robotsAllows } from "./parse";

// Daily check of public event listings. Everything found goes to the admin's
// "Suggested events" queue (status "pending"); nothing is published without
// approval. Sources are read politely: robots.txt is honoured, one request per
// page, a clear User-Agent, and a size/time limit.
//
// Instagram isn't a source: it has no public API for other accounts and
// doesn't allow scraping. Instagram-only events arrive as user suggestions.

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

export type SyncResult = { source: string; label: string; ok: boolean; found: number; added: number; error?: string };
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

/** Checks every source once and queues new upcoming events for approval. */
export async function syncEvents(): Promise<SyncStatus> {
  const results: SyncResult[] = [];
  const robotsCache = new Map<string, string>();
  const now = today().getTime();
  for (const source of SOURCES) {
    const result: SyncResult = { source: source.id, label: source.label, ok: false, found: 0, added: 0 };
    try {
      const u = new URL(source.url);
      if (!robotsCache.has(u.origin)) {
        robotsCache.set(u.origin, await fetchText(`${u.origin}/robots.txt`).catch(() => ""));
      }
      if (!robotsAllows(robotsCache.get(u.origin) ?? "", u.pathname)) throw new Error("Not allowed by robots.txt");
      const found = source.parse(await fetchText(source.url), source.url);
      result.found = found.length;
      for (const e of found) {
        const start = new Date(`${e.start}T00:00:00.000Z`);
        const end = e.end ? new Date(`${e.end}T00:00:00.000Z`) : null;
        if (Number.isNaN(start.getTime()) || (end ?? start).getTime() < now) continue;
        if (await db.event.findUnique({ where: { externalKey: e.key }, select: { id: true } })) continue;
        if (await isKnownEvent(e.name, start)) continue;
        await db.event.create({
          data: {
            name: e.name.slice(0, 120),
            startDate: start,
            endDate: end && end > start ? end : null,
            city: e.city.slice(0, 80),
            venue: e.venue?.slice(0, 120) ?? null,
            url: e.url.slice(0, 2000),
            sourceUrl: e.url.slice(0, 2000),
            status: "pending",
            source: "sync",
            externalKey: e.key.slice(0, 300),
          },
        });
        result.added += 1;
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
