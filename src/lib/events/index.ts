import "server-only";
import type { Event } from "@prisma/client";
import { db } from "../db";
import { ensureBuiltinData } from "./builtinSync";
import { nameSimilarity, normaliseName } from "./names";

export { normaliseName };

export type EventView = {
  id: string;
  name: string;
  start: Date;
  end: Date;
  time: string | null;
  city: string;
  country: string;
  venue: string | null;
  address: string | null;
  url: string | null;
  tickets: string | null;
  notes: string | null;
  eventType: string;
  announceStatus: string;
  sourceUrl: string | null;
  /** Where to open the place in a maps app, or null when there's no venue to search for */
  mapLink: string | null;
  /** Added by an admin (editable by them) rather than built in or found automatically */
  editable: boolean;
  organiserId: string | null;
};

/**
 * Link that opens the venue in Google Maps (the Maps app on phones). An exact
 * map link wins; otherwise it searches for the venue as the organiser names
 * it, plus the address and city. No venue → no link (a city alone is too vague).
 */
export function mapsLink(e: { venue?: string | null; address?: string | null; city: string; country?: string | null; mapUrl?: string | null }): string | null {
  if (e.mapUrl) return e.mapUrl;
  if (!e.venue && !e.address) return null;
  const query = [e.venue, e.address, e.city, e.country ?? "Portugal"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function eventView(r: Event): EventView {
  return {
    id: r.id,
    name: r.name,
    start: r.startDate,
    end: r.endDate ?? r.startDate,
    time: r.time,
    city: r.city,
    country: r.country,
    venue: r.venue,
    address: r.address,
    url: r.url,
    tickets: r.tickets,
    notes: r.notes,
    eventType: r.eventType,
    announceStatus: r.announceStatus,
    sourceUrl: r.sourceUrl,
    mapLink: mapsLink(r),
    editable: true,
    organiserId: r.organiserId,
  };
}

/** Approved events (built-in ones included), soonest first. */
export async function listEvents(): Promise<EventView[]> {
  await ensureBuiltinData();
  const rows = await db.event.findMany({ where: { status: "approved" }, orderBy: [{ startDate: "asc" }, { name: "asc" }] });
  return rows.map(eventView);
}

/** Today as UTC midnight of the server's local calendar day (same rule as deadlines). */
export function today(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Names of events that haven't ended yet, for suggestions in the project form. */
export async function upcomingEventNames(): Promise<string[]> {
  const t = today().getTime();
  const names = (await listEvents()).filter((e) => e.end.getTime() >= t).map((e) => e.name);
  return [...new Set(names)];
}

const DAY = 86_400_000;

/**
 * Events in the database (any status, so rejected ones count) that look like
 * the same event: dates within 3 days, and a similar name, or the same venue
 * or address with a loosely similar name.
 */
export async function findSimilarEvents(e: {
  name: string;
  start: Date;
  venue?: string | null;
  address?: string | null;
  excludeId?: string;
}): Promise<Event[]> {
  const rows = await db.event.findMany({
    where: {
      startDate: { gte: new Date(e.start.getTime() - 3 * DAY), lte: new Date(e.start.getTime() + 3 * DAY) },
      ...(e.excludeId ? { id: { not: e.excludeId } } : {}),
    },
  });
  const place = (x?: string | null) => (x ? normaliseName(x) : "");
  return rows.filter((r) => {
    const sim = nameSimilarity(r.name, e.name);
    const samePlace =
      (!!place(e.venue) && place(r.venue) === place(e.venue)) || (!!place(e.address) && place(r.address) === place(e.address));
    return sim >= 0.75 || (samePlace && sim >= 0.45);
  });
}

/** Things an admin should check before approving (shown in the review queue). */
export function reviewFlags(e: Pick<Event, "venue" | "address" | "sourceUrl" | "source" | "startDate" | "endDate">): string[] {
  const flags: string[] = [];
  if (!e.venue && !e.address) flags.push("noVenue");
  if (!e.sourceUrl && (e.source === "user" || e.source === "sync" || e.source === "instagram")) flags.push("noSource");
  const now = today().getTime();
  if (e.startDate.getTime() > now + 2 * 365 * DAY) flags.push("farFuture");
  if (e.endDate && e.endDate.getTime() - e.startDate.getTime() > 14 * DAY) flags.push("longRange");
  return flags;
}
