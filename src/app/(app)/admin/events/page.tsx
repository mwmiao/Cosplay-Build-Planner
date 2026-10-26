import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSyncStatus } from "@/lib/events/sync";
import { reviewEvent, runEventSync } from "./actions";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.queueTitle };
}

/** Suggested events (from users and the daily source check) waiting for approval. */
export default async function EventQueuePage() {
  await requireAdmin();
  const { t, f } = getI18n();
  const E = t.events;
  const [pending, status] = await Promise.all([
    db.event.findMany({ where: { status: "pending" }, orderBy: { startDate: "asc" } }),
    getSyncStatus(),
  ]);
  const range = (s: Date, e: Date | null) => (e && e.getTime() !== s.getTime() ? `${f.date(s)} – ${f.date(e)}` : f.date(s));

  return (
    <>
      <BackLink href="/events">{E.title}</BackLink>
      <h1 className="page-title mb-1">{E.queueTitle}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{E.queueIntro}</p>

      {pending.length === 0 ? (
        <p className="card text-sm text-zinc-500">{E.queueEmpty}</p>
      ) : (
        <ul className="space-y-3" data-testid="event-queue">
          {pending.map((e) => (
            <li key={e.id} className="card space-y-2" data-testid="queued-event">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{e.name}</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {e.source === "sync" ? E.fromSync : E.fromUser}
                </span>
              </div>
              <p className="text-sm tabular-nums">{range(e.startDate, e.endDate)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{[e.venue, e.address, e.city].filter(Boolean).join(" · ")}</p>
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
          ))}
        </ul>
      )}

      <section className="card mt-8 space-y-3" aria-labelledby="sources-title">
        <h2 id="sources-title" className="section-title">
          {E.sourcesTitle}
        </h2>
        <p className="hint">{E.sourcesIntro}</p>
        {status ? (
          <>
            <p className="text-sm">{E.lastCheck(f.dateTime(new Date(status.at)))}</p>
            <ul className="space-y-1 text-sm">
              {status.results.map((r) => (
                <li key={r.source} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{r.label}</span>
                  {r.ok ? (
                    <span className="text-zinc-500 dark:text-zinc-400">{E.sourceOk(r.found, r.added)}</span>
                  ) : (
                    <span className="text-red-700 dark:text-red-400">{E.sourceFailed(r.error ?? "")}</span>
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
