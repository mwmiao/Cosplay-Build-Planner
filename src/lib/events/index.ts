import "server-only";
import { db } from "../db";
import { BUILTIN_EVENTS } from "./builtin";

export type EventView = {
  /** "b:<key>" for built-in events, the database id for admin-added ones */
  id: string;
  name: string;
  start: Date;
  end: Date;
  city: string;
  venue: string | null;
  url: string | null;
  notes: string | null;
  builtin: boolean;
  dateUnconfirmed: boolean;
};

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Built-in and admin-added events, soonest first. */
export async function listEvents(): Promise<EventView[]> {
  const rows = await db.event.findMany({ orderBy: { startDate: "asc" } });
  const events: EventView[] = [
    ...BUILTIN_EVENTS.map((e) => ({
      id: `b:${e.key}`,
      name: e.name,
      start: day(e.start),
      end: day(e.end ?? e.start),
      city: e.city,
      venue: e.venue ?? null,
      url: e.url ?? null,
      notes: null,
      builtin: true,
      dateUnconfirmed: e.note === "dateUnconfirmed",
    })),
    ...rows.map((r) => ({
      id: r.id,
      name: r.name,
      start: r.startDate,
      end: r.endDate ?? r.startDate,
      city: r.city,
      venue: r.venue,
      url: r.url,
      notes: r.notes,
      builtin: false,
      dateUnconfirmed: false,
    })),
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
