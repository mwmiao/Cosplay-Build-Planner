import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { findSimilarEvents, reviewFlags } from "@/lib/events";
import { instagramConfig } from "@/lib/events/instagram";
import { getSyncStatus } from "@/lib/events/sync";
import { resolveChange, reviewEvent, runEventSync } from "./actions";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.queueTitle };
}

/** Events waiting for review, changes reported by sources, and the daily check's status. */
export default async function EventQueuePage() {
  await requireAdmin();
  const { t, f } = getI18n();
  const E = t.events;
  const [pending, changed, status, organiserCount] = await Promise.all([
    db.event.findMany({ where: { status: "needs_review" }, orderBy: { startDate: "asc" }, include: { organiser: { select: { name: true } } } }),
    db.event.findMany({ where: { pendingChange: { not: null }, status: { not: "rejected" } }, orderBy: { startDate: "asc" } }),
    getSyncStatus(),
    db.organiser.count({ where: { active: true, instagram: { not: null } } }),
  ]);
  const duplicates = new Map(
    await Promise.all(
      pending.map(async (e) => [e.id, await findSimilarEvents({ name: e.name, start: e.startDate, venue: e.venue, address: e.address, excludeId: e.id })] as const),
    ),
  );
  const range = (s: Date, e: Date | null) => (e && e.getTime() !== s.getTime() ? `${f.date(s)} – ${f.date(e)}` : f.date(s));
  const sourceLabel = (s: string) => (E.sourceLabels as Record<string, string>)[s] ?? s;
  const fieldLabel = (k: string) => (E.fieldLabels as Record<string, string>)[k] ?? k;

  return (
    <>
      <BackLink href="/events">{E.title}</BackLink>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{E.queueTitle}</h1>
        <Link href="/admin/organisers" className="btn-secondary">
          {t.organisers.title}
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{E.queueIntro}</p>

      {pending.length === 0 ? (
        <p className="card text-sm text-zinc-500">{E.queueEmpty}</p>
      ) : (
        <ul className="space-y-3" data-testid="event-queue">
          {pending.map((e) => {
            const flags = reviewFlags(e);
            const dupes = duplicates.get(e.id) ?? [];
            return (
              <li key={e.id} className="card space-y-2" data-testid="queued-event">
                <div className="flex gap-3">
                  {e.posterUrl ? (
                    // Source image, only shown here while reviewing (it may expire).
                    <img src={e.posterUrl} alt="" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{e.name}</h2>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {sourceLabel(e.source)}
                      </span>
                    </div>
                    <p className="text-sm tabular-nums">
                      {range(e.startDate, e.endDate)}
                      {e.time ? ` · ${e.time}` : ""}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{[e.venue, e.address, e.city].filter(Boolean).join(" · ")}</p>
                    {e.organiser ? <p className="hint">{E.byOrganiser(e.organiser.name)}</p> : null}
                    {e.capturedAt ? <p className="hint">{E.capturedOn(f.dateTime(e.capturedAt))}</p> : null}
                  </div>
                </div>
                {flags.length || dupes.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label={E.flagsLabel}>
                    {flags.map((flag) => (
                      <li key={flag} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {(E.flags as Record<string, string>)[flag] ?? flag}
                      </li>
                    ))}
                    {dupes.length ? (
                      <li className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {E.possibleDuplicate(dupes.map((d) => d.name).join(", "))}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {e.notes ? <p className="whitespace-pre-wrap break-words text-sm">{e.notes}</p> : null}
                {e.sourceUrl ? (
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="link break-all text-sm">
                    {E.whereFound}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <form action={reviewEvent.bind(null, e.id, true)}>
                    <SubmitButton className="btn-primary" pendingText="…">
                      {E.approve}
                    </SubmitButton>
                  </form>
                  <Link href={`/admin/events/${e.id}`} className="btn-secondary">
                    {E.editFirst}
                  </Link>
                  <form action={reviewEvent.bind(null, e.id, false)}>
                    <SubmitButton className="btn-ghost text-red-700 dark:text-red-400" pendingText="…">
                      {E.reject}
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {changed.length ? (
        <section className="mt-8 space-y-3" aria-labelledby="changes-title" data-testid="event-changes">
          <h2 id="changes-title" className="section-title">
            {E.changesTitle}
          </h2>
          <p className="hint">{E.changesIntro}</p>
          {changed.map((e) => {
            let change: { source?: string; url?: string | null; changes?: Record<string, [unknown, unknown]> } = {};
            try {
              change = JSON.parse(e.pendingChange ?? "{}");
            } catch {
              change = {};
            }
            return (
              <div key={e.id} className="card space-y-2" data-testid="changed-event">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{e.name}</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {sourceLabel(change.source ?? "")}
                  </span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {Object.entries(change.changes ?? {}).map(([field, [before, after]]) => (
                    <div key={field} className="contents">
                      <dt className="font-medium">{fieldLabel(field)}</dt>
                      <dd className="break-words">
                        <span className="text-zinc-500 line-through">{String(before ?? "—")}</span> → <span>{String(after ?? "—")}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {change.url ? (
                  <a href={change.url} target="_blank" rel="noopener noreferrer nofollow" className="link break-all text-sm">
                    {E.whereFound}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={resolveChange.bind(null, e.id, true)}>
                    <SubmitButton className="btn-primary" pendingText="…">
                      {E.applyChange}
                    </SubmitButton>
                  </form>
                  <form action={resolveChange.bind(null, e.id, false)}>
                    <SubmitButton className="btn-ghost" pendingText="…">
                      {E.dismissChange}
                    </SubmitButton>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="card mt-8 space-y-3" aria-labelledby="sources-title">
        <h2 id="sources-title" className="section-title">
          {E.sourcesTitle}
        </h2>
        <p className="hint">{E.sourcesIntro}</p>
        <p className="text-sm">
          {instagramConfig() ? E.instagramReady(organiserCount) : E.instagramNotSetUp}{" "}
          <Link href="/admin/organisers" className="link">
            {t.organisers.manage}
          </Link>
        </p>
        {status ? (
          <>
            <p className="text-sm">{E.lastCheck(f.dateTime(new Date(status.at)))}</p>
            <ul className="space-y-1 text-sm">
              {status.results.map((r) => (
                <li key={r.source} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{r.label}</span>
                  {r.ok ? (
                    <span className="text-zinc-500 dark:text-zinc-400">{E.sourceOk(r.found, r.added, r.changed ?? 0)}</span>
                  ) : (
                    <span className="text-red-700 dark:text-red-400">{E.sourceFailed(r.error === "notSetUp" ? E.instagramNotSetUp : (r.error ?? ""))}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{E.neverChecked}</p>
        )}
        <form action={runEventSync}>
          <SubmitButton className="btn-secondary" pendingText={E.checking}>
            {E.checkNow}
          </SubmitButton>
        </form>
      </section>
    </>
  );
}
