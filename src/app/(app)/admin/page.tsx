import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { SubmitButton } from "@/components/FormBits";
import { adminCounts } from "@/lib/adminCounts";
import { requireModerator } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeHttpUrl } from "@/lib/safeUrl";
import { dismissReports } from "./actions";
import { markNotificationsRead } from "./instagram/actions";
import { RemoveForm } from "./RemoveForm";

type NotificationDetail = { date?: string | null; location?: string | null; username?: string | null; permalink?: string | null; preview?: string };

export function generateMetadata(): Metadata {
  return { title: getI18n().t.admin.title };
}

export default async function AdminPage({ searchParams }: { searchParams: { removed?: string; dismissed?: string } }) {
  const user = await requireModerator();
  const { t, f } = getI18n();
  const A = t.admin;
  const R = t.community.report;
  const [counts, notifications, publications, log, openReports] = await Promise.all([
    adminCounts(user),
    user.isAdmin ? db.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: 30 }) : [],
    db.publication.findMany({
      where: { project: { deletedAt: null } },
      orderBy: { versionAt: "desc" },
      select: { id: true, title: true, versionAt: true, owner: { select: { name: true } } },
      take: 200,
    }),
    db.moderationAction.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    // Who reported is deliberately not loaded: moderators judge the project, not the reporter.
    db.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      select: { id: true, reason: true, note: true, createdAt: true, publication: { select: { id: true, title: true, owner: { select: { name: true } } } } },
    }),
  ]);
  const reported = [...new Set(openReports.map((r) => r.publication.id))].map((id) => {
    const reports = openReports.filter((r) => r.publication.id === id);
    return { publication: reports[0]!.publication, reports };
  });

  return (
    <>
      <h1 className="page-title">{A.title}</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{A.intro}</p>
      <section id="reports" aria-labelledby="mod-reports" className="mb-8 scroll-mt-4" data-testid="reports">
        <h2 id="mod-reports" className="section-title mb-2">
          {A.reports} {counts.reports ? <span className="text-sm font-normal text-zinc-600">({counts.reports})</span> : null}
        </h2>
        {searchParams.dismissed === "1" && (
          <p role="status" className="mb-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            {A.dismissed}
          </p>
        )}
        {reported.length === 0 ? (
          <p className="text-sm text-zinc-600">{A.reportsEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {reported.map(({ publication: p, reports }) => (
              <li key={p.id} className="card space-y-2" data-testid="report-item">
                <div>
                  <Link href={`/community/${p.id}`} className="link font-semibold">
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {A.by(p.owner.name)} · {A.reportCount(reports.length)}
                  </p>
                </div>
                <ul className="space-y-1 text-sm">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium">{(R.reasons as Record<string, string>)[r.reason] ?? r.reason}</span>
                      <span className="text-zinc-600"> · {f.date(r.createdAt)}</span>
                      {r.note ? <p className="whitespace-pre-wrap break-words text-zinc-600 dark:text-zinc-300">{r.note}</p> : null}
                    </li>
                  ))}
                </ul>
                <form action={dismissReports.bind(null, p.id)}>
                  <SubmitButton className="btn-secondary" pendingText={t.common.working}>
                    {A.dismiss}
                  </SubmitButton>
                </form>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-red-700 dark:text-red-400">{A.remove}</summary>
                  <div className="pt-2">
                    <RemoveForm publicationId={p.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.isAdmin ? (
        <>
      <Link href="/admin/users" className="card mb-3 flex items-center justify-between gap-3 p-3 text-sm font-medium hover:border-brand-400">
        {A.users} <span aria-hidden="true">→</span>
      </Link>
      <Link href="/admin/events" className="card mb-6 flex items-center justify-between gap-3 p-3 text-sm font-medium hover:border-brand-400">
        {counts.toReview ? t.events.pendingBanner(counts.toReview) : t.events.queueTitle} <span aria-hidden="true">→</span>
      </Link>

      <section aria-labelledby="notifications-title" className="mb-8" data-testid="notifications">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="notifications-title" className="section-title">
            {A.notifications} {counts.unread ? <span className="text-sm font-normal text-zinc-600">({A.unread(counts.unread)})</span> : null}
          </h2>
          {counts.unread ? (
            <form action={markNotificationsRead}>
              <SubmitButton className="btn-ghost min-h-9" pendingText="…">
                {A.markAllRead}
              </SubmitButton>
            </form>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-zinc-600">{A.noNotifications}</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              let d: NotificationDetail = {};
              try {
                d = JSON.parse(n.detail);
              } catch {
                d = {};
              }
              return (
                <li
                  key={n.id}
                  data-testid="notification"
                  className={`card space-y-1 p-3 ${n.readAt ? "" : "border-brand-300 dark:border-brand-700"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {n.readAt ? null : <span className="h-2 w-2 rounded-full bg-brand-500" aria-label={A.unreadLabel} />}
                    <span className="font-semibold">{n.title}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {(A.notificationKinds as Record<string, string>)[n.kind] ?? n.kind}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {[d.date, d.location, d.username ? `@${d.username}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {d.preview ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.preview}</p> : null}
                  <div className="flex flex-wrap gap-x-4 text-sm">
                    <Link href="/admin/events" className="link">
                      {A.review}
                    </Link>
                    {safeHttpUrl(d.permalink) ? (
                      <a href={safeHttpUrl(d.permalink)!} target="_blank" rel="noopener noreferrer nofollow" className="link">
                        {t.instagram.openPost}
                      </a>
                    ) : null}
                    <span className="text-zinc-600">{f.dateTime(n.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
        </>
      ) : null}
      {searchParams.removed === "1" && (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {A.removed}
        </p>
      )}

      <section aria-labelledby="mod-published" className="mb-8">
        <h2 id="mod-published" className="section-title mb-2">
          {A.published}
        </h2>
        {publications.length === 0 ? (
          <p className="text-sm text-zinc-600">{A.none}</p>
        ) : (
          <ul className="space-y-3">
            {publications.map((p) => (
              <li key={p.id} id={`pub-${p.id}`} className="card space-y-2" data-testid="moderation-item">
                <div>
                  <Link href={`/community/${p.id}`} className="link font-semibold">
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {A.by(p.owner.name)} · {A.published_on(f.date(p.versionAt))}
                  </p>
                </div>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-red-700 dark:text-red-400">
                    {A.remove}
                  </summary>
                  <div className="pt-2">
                    <RemoveForm publicationId={p.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mod-log">
        <h2 id="mod-log" className="section-title mb-2">
          {A.log}
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-zinc-600">{A.logEmpty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {log.map((m) => (
              <li key={m.id} className="card p-3">
                <div className="font-medium">{A.logEntry(m.publicationTitle, f.dateTime(m.createdAt))}</div>
                <div className="whitespace-pre-wrap break-words text-zinc-600 dark:text-zinc-300">{m.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
