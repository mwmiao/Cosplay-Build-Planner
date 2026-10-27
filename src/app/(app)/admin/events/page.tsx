import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { findSimilarEvents, reviewFlags } from "@/lib/events";
import { getSyncStatus } from "@/lib/events/sync";
import { approvePost, markNotEvent, rejectPost, resolveEventUpdate } from "../instagram/actions";
import { resolveChange, reviewEvent, runEventSync } from "./actions";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.queueTitle };
}

type Extracted = { name?: string; start?: string; end?: string; time?: string; venue?: string; address?: string; city?: string; tickets?: string; ticketUrl?: string };

function parse<T>(json: string | null, fallback: T): T {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Admin review: Instagram posts detected as (possible) events, other suggested
 * events, proposed updates to existing events, and the sources' status.
 * Nothing here is public until approved.
 */
export default async function EventQueuePage() {
  await requireAdmin();
  const { t, f } = getI18n();
  const E = t.events;
  const S = t.instagram;
  const [posts, updates, otherPending, changed, status] = await Promise.all([
    db.instagramPost.findMany({
      where: { reviewStatus: "pending_review" },
      orderBy: { createdAt: "desc" },
      include: { source: { select: { username: true } }, event: true },
    }),
    db.eventUpdate.findMany({
      where: { status: "pending_review" },
      orderBy: { createdAt: "desc" },
      include: { event: true, post: { include: { source: { select: { username: true } } } } },
    }),
    db.event.findMany({
      where: { status: "pending_review", source: { not: "instagram" } },
      orderBy: { startDate: "asc" },
      include: { organiser: { select: { name: true } } },
    }),
    db.event.findMany({ where: { pendingChange: { not: null }, status: { not: "rejected" } }, orderBy: { startDate: "asc" } }),
    getSyncStatus(),
  ]);
  const duplicates = new Map(
    await Promise.all(
      otherPending.map(async (e) => [e.id, await findSimilarEvents({ name: e.name, start: e.startDate, venue: e.venue, address: e.address, excludeId: e.id })] as const),
    ),
  );
  const range = (s: Date, e: Date | null) => (e && e.getTime() !== s.getTime() ? `${f.date(s)} – ${f.date(e)}` : f.date(s));
  const sourceLabel = (s: string) => (E.sourceLabels as Record<string, string>)[s] ?? s;
  const fieldLabel = (k: string) => (E.fieldLabels as Record<string, string>)[k] ?? k;
  const chip = "rounded-full px-2 py-0.5 text-[11px] font-semibold";

  return (
    <>
      <BackLink href="/admin">{t.admin.title}</BackLink>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{E.queueTitle}</h1>
        <Link href="/admin/organisers" className="btn-secondary">
          {t.organisers.title}
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{E.queueIntro}</p>

      <section aria-labelledby="pending-title" className="mb-8">
        <h2 id="pending-title" className="section-title mb-2">
          {S.pendingTitle} {posts.length + otherPending.length ? <span className="text-sm font-normal text-zinc-500">({posts.length + otherPending.length})</span> : null}
        </h2>
        {posts.length + otherPending.length === 0 ? (
          <p className="card text-sm text-zinc-500">{E.queueEmpty}</p>
        ) : null}

        {posts.length ? (
          <ul className="mb-3 space-y-3" data-testid="pending-posts">
            {posts.map((p) => {
              const x = parse<Extracted>(p.extracted, {});
              const event = p.event;
              const possible = !event;
              return (
                <li key={p.id} className="card space-y-2" data-testid="pending-post">
                  <div className="flex gap-3">
                    {p.imageUrl ? (
                      // The post's image from the feed, only shown here while reviewing (it may expire).
                      <img src={p.imageUrl} alt="" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{event?.name ?? x.name ?? S.untitled}</h3>
                        <span className={`${chip} ${possible ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"}`}>
                          {possible ? S.possibleEvent : S.detectedEvent}
                        </span>
                        <span className={`${chip} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}>{S.confidence(p.confidence)}</span>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {p.source ? `@${p.source.username}` : S.manual}
                        {p.publishedAt ? ` · ${S.postedOn(f.date(p.publishedAt))}` : ""}
                      </p>
                      {p.reason ? <p className="hint">{S.reason(p.reason)}</p> : null}
                    </div>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm" aria-label={S.extracted}>
                    {(
                      [
                        [E.name, event?.name ?? x.name],
                        [E.startDate, event ? range(event.startDate, event.endDate) : x.start ? [x.start, x.end].filter(Boolean).join(" – ") : null],
                        [E.time, event?.time ?? x.time],
                        [E.venue, event?.venue ?? x.venue],
                        [E.address, event?.address ?? x.address],
                        [E.city, event?.city ?? x.city],
                        [E.tickets, event?.tickets ?? x.tickets],
                        [S.ticketLink, x.ticketUrl],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="font-medium">{k}</dt>
                          <dd className="break-words">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  {p.caption ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">{S.originalCaption}</summary>
                      <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">{p.caption}</p>
                    </details>
                  ) : null}
                  {p.permalink ? (
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer nofollow" className="link break-all text-sm">
                      {S.openPost}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {event ? (
                      <form action={approvePost.bind(null, p.id)}>
                        <SubmitButton className="btn-primary" pendingText="…">
                          {E.approve}
                        </SubmitButton>
                      </form>
                    ) : null}
                    <Link href={event ? `/admin/events/${event.id}` : `/admin/events/new?post=${p.id}`} className="btn-secondary">
                      {event ? E.editFirst : S.createFromPost}
                    </Link>
                    <form action={rejectPost.bind(null, p.id)}>
                      <SubmitButton className="btn-ghost text-red-700 dark:text-red-400" pendingText="…">
                        {E.reject}
                      </SubmitButton>
                    </form>
                    <form action={markNotEvent.bind(null, p.id)}>
                      <SubmitButton className="btn-ghost" pendingText="…">
                        {S.notEvent}
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {otherPending.length ? (
          <ul className="space-y-3" data-testid="event-queue">
            {otherPending.map((e) => {
              const flags = reviewFlags(e);
              const dupes = duplicates.get(e.id) ?? [];
              return (
                <li key={e.id} className="card space-y-2" data-testid="queued-event">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{e.name}</h3>
                    <span className={`${chip} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}>{sourceLabel(e.source)}</span>
                  </div>
                  <p className="text-sm tabular-nums">
                    {range(e.startDate, e.endDate)}
                    {e.time ? ` · ${e.time}` : ""}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{[e.venue, e.address, e.city].filter(Boolean).join(" · ")}</p>
                  {e.organiser ? <p className="hint">{E.byOrganiser(e.organiser.name)}</p> : null}
                  {e.capturedAt ? <p className="hint">{E.capturedOn(f.dateTime(e.capturedAt))}</p> : null}
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
        ) : null}
      </section>

      {updates.length ? (
        <section className="mb-8 space-y-3" aria-labelledby="updates-title" data-testid="event-updates">
          <h2 id="updates-title" className="section-title">
            {S.updatesTitle}
          </h2>
          <p className="hint">{S.updatesIntro}</p>
          {updates.map((u) => {
            const changes = parse<Record<string, [unknown, unknown]>>(u.changes, {});
            return (
              <div key={u.id} className="card space-y-2" data-testid="event-update">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{u.event.name}</h3>
                  <span className={`${chip} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}>
                    {u.post.source ? `@${u.post.source.username}` : S.manual}
                  </span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {Object.entries(changes).map(([field, [before, after]]) => (
                    <div key={field} className="contents">
                      <dt className="font-medium">{fieldLabel(field)}</dt>
                      <dd className="break-words">
                        <span className="text-zinc-500 line-through">{String(before ?? "—")}</span> → <span>{String(after ?? "—")}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {u.post.caption ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">{S.originalCaption}</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">{u.post.caption}</p>
                  </details>
                ) : null}
                {u.post.permalink ? (
                  <a href={u.post.permalink} target="_blank" rel="noopener noreferrer nofollow" className="link break-all text-sm">
                    {S.openPost}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={resolveEventUpdate.bind(null, u.id, true)}>
                    <SubmitButton className="btn-primary" pendingText="…">
                      {E.applyChange}
                    </SubmitButton>
                  </form>
                  <form action={resolveEventUpdate.bind(null, u.id, false)}>
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

      {changed.length ? (
        <section className="mb-8 space-y-3" aria-labelledby="changes-title" data-testid="event-changes">
          <h2 id="changes-title" className="section-title">
            {E.changesTitle}
          </h2>
          <p className="hint">{E.changesIntro}</p>
          {changed.map((e) => {
            const change = parse<{ source?: string; url?: string | null; changes?: Record<string, [unknown, unknown]> }>(e.pendingChange, {});
            return (
              <div key={e.id} className="card space-y-2" data-testid="changed-event">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{e.name}</h3>
                  <span className={`${chip} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`}>{sourceLabel(change.source ?? "")}</span>
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

      <section className="card space-y-3" aria-labelledby="sources-title">
        <h2 id="sources-title" className="section-title">
          {E.sourcesTitle}
        </h2>
        <p className="hint">{E.sourcesIntro}</p>
        <p className="text-sm">
          <Link href="/admin/organisers#instagram" className="link">
            {S.manageSources}
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
