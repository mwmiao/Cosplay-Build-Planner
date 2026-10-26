import "server-only";
import type { Event } from "@prisma/client";
import { db } from "../db";
import { BUILTIN_EVENTS } from "./builtin";
import { normaliseName } from "./names";

export { normaliseName };

export type EventView = {
  /** "b:<key>" for built-in events, the database id for the others */
  id: string;
  name: string;
  start: Date;
  end: Date;
  city: string;
  venue: string | null;
  address: string | null;
  url: string | null;
  notes: string | null;
  /** Where to open the place in a maps app, or null when there's no venue to search for */
  mapLink: string | null;
  builtin: boolean;
  dateUnconfirmed: boolean;
};

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * Link that opens the venue in Google Maps (the Maps app on phones). An exact
 * map link wins; otherwise it searches for the venue as the organiser names
 * it, plus the address and city. No venue → no link (a city alone is too vague).
 */
export function mapsLink(e: { venue?: string | null; address?: string | null; city: string; mapUrl?: string | null }): string | null {
  if (e.mapUrl) return e.mapUrl;
  if (!e.venue && !e.address) return null;
  const query = [e.venue, e.address, e.city, "Portugal"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function eventView(r: Event): EventView {
  return {
    id: r.id,
    name: r.name,
    start: r.startDate,
    end: r.endDate ?? r.startDate,
    city: r.city,
    venue: r.venue,
    address: r.address,
    url: r.url,
    notes: r.notes,
    mapLink: mapsLink(r),
    builtin: false,
    dateUnconfirmed: false,
  };
}

/** Built-in and approved events, soonest first. */
export async function listEvents(): Promise<EventView[]> {
  const rows = await db.event.findMany({ where: { status: "approved" }, orderBy: { startDate: "asc" } });
  const events: EventView[] = [
    ...BUILTIN_EVENTS.map((e) => ({
      id: `b:${e.key}`,
      name: e.name,
      start: day(e.start),
      end: day(e.end ?? e.start),
      city: e.city,
      venue: e.venue ?? null,
      address: e.address ?? null,
      url: e.url ?? null,
      notes: null,
      mapLink: mapsLink(e),
      builtin: true,
      dateUnconfirmed: e.note === "dateUnconfirmed",
    })),
    ...rows.map(eventView),
  ];
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || a.name.localeCompare(b.name));
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

/**
 * Is this (name, start day) already known — built in, or in the database with
 * any status (so rejected suggestions don't come back)? Names match when one
 * contains the other ("XL Games Aveiro" ~ "XL Games 2026 – Aveiro" is handled
 * by also comparing without years/digits).
 */
export async function isKnownEvent(name: string, start: Date): Promise<boolean> {
  const key = normaliseName(name);
  const loose = key.replace(/\d+/g, "");
  const same = (other: string) => {
    const k = normaliseName(other);
    const l = k.replace(/\d+/g, "");
    return k === key || k.includes(key) || key.includes(k) || (l.length >= 6 && (l.includes(loose) || loose.includes(l)));
  };
  const dayMs = 86_400_000;
  const near = (d: Date) => Math.abs(d.getTime() - start.getTime()) <= 3 * dayMs;
  if (BUILTIN_EVENTS.some((e) => near(day(e.start)) && same(e.name))) return true;
  const rows = await db.event.findMany({
    where: { startDate: { gte: new Date(start.getTime() - 3 * dayMs), lte: new Date(start.getTime() + 3 * dayMs) } },
    select: { name: true },
  });
  return rows.some((r) => same(r.name));
}
