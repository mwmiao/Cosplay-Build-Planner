import "server-only";
import { createHash } from "node:crypto";
import { db } from "../db";
import { BUILTIN_EVENTS, BUILTIN_ORGANISERS, type BuiltinEvent } from "./builtin";
import { diffFields } from "./diff";

// Keeps the built-in event list (src/lib/events/builtin.ts) in the Event table:
// - a new built-in event is added (approved);
// - a changed built-in event is updated in place, unless an admin has edited
//   it: then the change goes to the review queue (pendingChange) instead of
//   overwriting their edit;
// - an event the admin deleted stays hidden (status "rejected"), never re-added.
// Built-in organisers are added once; afterwards the admin manages them.

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function fields(e: BuiltinEvent) {
  return {
    name: e.name,
    startDate: day(e.start),
    endDate: e.end ? day(e.end) : null,
    city: e.city,
    venue: e.venue ?? null,
    address: e.address ?? null,
    mapUrl: e.mapUrl ?? null,
    url: e.url ?? null,
    notes: e.notes ?? null,
    eventType: e.eventType,
    announceStatus: e.announceStatus,
    sourceUrl: e.sourceUrl ?? e.url ?? null,
  };
}

const fingerprint = (e: BuiltinEvent) => createHash("sha256").update(JSON.stringify(e)).digest("hex").slice(0, 32);

async function syncOrganisers() {
  const flag = await db.setting.findUnique({ where: { key: "organisers.seeded" } });
  if (flag) return;
  for (const o of BUILTIN_ORGANISERS) {
    const exists = await db.organiser.findFirst({ where: { name: o.name } });
    if (exists) continue;
    const { instagram, ...fields } = o;
    const organiser = await db.organiser.create({ data: fields });
    // Its Instagram account is watched by the Instagram monitor.
    if (instagram && !(await db.instagramSource.findUnique({ where: { username: instagram } }))) {
      await db.instagramSource.create({ data: { username: instagram, displayName: o.name, organiserId: organiser.id } });
    }
  }
  await db.setting.create({ data: { key: "organisers.seeded", value: new Date().toISOString() } });
}

async function syncEvents() {
  const organisers = new Map((await db.organiser.findMany({ select: { id: true, name: true } })).map((o) => [o.name, o.id]));
  for (const e of BUILTIN_EVENTS) {
    const key = `builtin:${e.key}`;
    const hash = fingerprint(e);
    const row = await db.event.findUnique({ where: { externalKey: key } });
    const data = fields(e);
    if (!row) {
      await db.event.create({
        data: {
          ...data,
          status: "approved",
          source: "builtin",
          externalKey: key,
          builtinHash: hash,
          capturedAt: new Date(),
          organiserId: e.organiser ? (organisers.get(e.organiser) ?? null) : null,
        },
      });
      continue;
    }
    if (row.builtinHash === hash) continue;
    if (!row.editedAt) {
      await db.event.update({ where: { id: row.id }, data: { ...data, builtinHash: hash, capturedAt: new Date() } });
    } else {
      // The admin changed this event: offer the update instead of overwriting it.
      const changes = diffFields(row, data);
      await db.event.update({
        where: { id: row.id },
        data: { builtinHash: hash, pendingChange: Object.keys(changes).length ? JSON.stringify({ source: "builtin", changes }) : null },
      });
    }
  }
}

let running: Promise<void> | null = null;
let doneAt = 0;

/** Brings the built-in data up to date once per process (and at most every 10 minutes). */
export function ensureBuiltinData(): Promise<void> {
  if (running) return running;
  if (Date.now() - doneAt < 10 * 60_000) return Promise.resolve();
  running = (async () => {
    try {
      await syncOrganisers();
      await syncEvents();
      doneAt = Date.now();
    } catch (err) {
      console.error("Updating built-in events failed", err);
    } finally {
      running = null;
    }
  })();
  return running;
}
