import { ensureBuiltinData } from "./events/builtinSync";
import { cleanupExpiredGuests } from "./guest";
import { getSyncStatus, syncEvents } from "./events/sync";

// Background jobs inside the app process:
// - every hour: delete guests older than 30 days (and their files);
// - once a day: check the public event sources and queue new events for admin
//   approval. A restart doesn't cause an extra check: it waits until the last
//   check is a day old. (EVENT_SYNC_HOURS=0 turns it off; the tests and CI use
//   that so they never contact outside sites.)

const HOUR = 60 * 60 * 1000;
const g = globalThis as unknown as { __cbpJobs?: boolean };

export function startJobs() {
  if (g.__cbpJobs) return; // once per process (dev reloads)
  g.__cbpJobs = true;

  const cleanup = () =>
    cleanupExpiredGuests()
      .then((n) => n && console.log(`Removed ${n} expired guest account(s).`))
      .catch((err) => console.error("Guest cleanup failed", err));
  setTimeout(cleanup, 30_000);
  // Built-in events: add new ones / refresh changed ones from this release.
  setTimeout(() => void ensureBuiltinData(), 5_000);
  setInterval(cleanup, HOUR);

  const hours = Number(process.env.EVENT_SYNC_HOURS ?? "24");
  if (!Number.isFinite(hours) || hours <= 0) return;
  const every = hours * HOUR;
  const maybeSync = async () => {
    try {
      const last = await getSyncStatus();
      if (last && Date.now() - new Date(last.at).getTime() < every - 5 * 60_000) return;
      const status = await syncEvents();
      const added = status.results.reduce((n, r) => n + r.added, 0);
      console.log(`Events check: ${added} new suggestion(s).`);
    } catch (err) {
      console.error("Events check failed", err);
    }
  };
  setTimeout(maybeSync, 2 * 60_000);
  setInterval(maybeSync, HOUR);
}
