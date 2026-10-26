import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, DownloadIcon, PlusIcon } from "@/components/Icons";
import { EmptyState, ProgressBar, StatusBadge } from "@/components/ui";
import { ViewControls } from "@/components/ViewControls";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { statusLabel } from "@/lib/constants";
import { daysLabel, daysUntil } from "@/lib/format";
import { projectStats } from "@/lib/projects";
import { GUEST_MAX_PROJECTS } from "@/lib/guest";
import { getMoneyContext } from "@/lib/queries";
import { viewPrefs } from "@/lib/viewPrefs";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.projects.title };
}

const SORTS = ["deadline", "start", "updated", "created", "name", "progress"] as const;
type Sort = (typeof SORTS)[number];

/** Dates first-soonest; missing dates last. */
const byDate = (a: Date | null, b: Date | null) =>
  a && b ? a.getTime() - b.getTime() : a ? -1 : b ? 1 : 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { view?: string; sort?: string; layout?: string; welcome?: string; limit?: string };
}) {
  const user = await requireUser();
  const { t, f } = getI18n();
  const archived = searchParams.view === "archived";
  const { sort, view } = viewPrefs<Sort>("projects-view", searchParams, SORTS, { sort: "deadline", view: "list" });
  const projects = await db.project.findMany({
    where: { ownerId: user.id, deletedAt: null, archivedAt: archived ? { not: null } : null },
    include: {
      parts: {
        where: { deletedAt: null },
        select: {
          status: true,
          currency: true,
          estimatedCostCents: true,
          actualCostCents: true,
          quantity: true,
          paidAt: true,
          paidBaseCents: true,
        },
      },
      // Only the main picture chosen by the owner (never just the first reference).
      references: { where: { kind: "cover" }, take: 1, select: { thumbPath: true } },
      publication: { select: { id: true } },
    },
  });

  const ctx = await getMoneyContext(user.id);
  const rows = projects.map((p) => ({ p, stats: projectStats(p, p.parts, ctx) }));
  const collator = new Intl.Collator(t.intl, { sensitivity: "base", numeric: true });
  const compare: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    deadline: (a, b) => byDate(a.p.deadline, b.p.deadline) || b.p.updatedAt.getTime() - a.p.updatedAt.getTime(),
    start: (a, b) => byDate(a.p.startDate, b.p.startDate) || byDate(a.p.deadline, b.p.deadline),
    updated: (a, b) => b.p.updatedAt.getTime() - a.p.updatedAt.getTime(),
    created: (a, b) => b.p.createdAt.getTime() - a.p.createdAt.getTime(),
    name: (a, b) => collator.compare(a.p.characterName, b.p.characterName),
    progress: (a, b) => b.stats.completion - a.stats.completion || byDate(a.p.deadline, b.p.deadline),
  };
  rows.sort(compare[sort]);

  const S = t.projects.sort;
  const archivedHref = (on: boolean) => {
    const qs = new URLSearchParams();
    if (on) qs.set("view", "archived");
    if (searchParams.sort) qs.set("sort", sort);
    if (searchParams.layout) qs.set("layout", view);
    const s = qs.toString();
    return `/projects${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="page-title">{archived ? t.projects.archivedTitle : t.projects.title}</h1>
        <div className="flex gap-2">
          <Link href="/projects/import" className="btn-secondary" aria-label={t.transfer.import}>
            <DownloadIcon className="h-5 w-5 rotate-180" /> <span className="hidden sm:inline">{t.transfer.import}</span>
          </Link>
          <Link href="/projects/new" className="btn-primary">
            <PlusIcon className="h-5 w-5" /> {t.nav.newProject}
          </Link>
        </div>
      </header>

      {searchParams.welcome === "guest" && user.isGuest ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {t.guest.welcome}
        </div>
      ) : null}
      {searchParams.limit ? (
        <div role="alert" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t.guest.projectLimit(GUEST_MAX_PROJECTS)}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="group" aria-label={t.projects.show}>
          <Link href={archivedHref(false)} className={archived ? "chip-off" : "chip-on"} aria-current={!archived ? "page" : undefined}>
            {t.projects.active}
          </Link>
          <Link href={archivedHref(true)} className={archived ? "chip-on" : "chip-off"} aria-current={archived ? "page" : undefined}>
            {t.projects.archived}
          </Link>
        </div>
        {rows.length > 1 ? (
          <ViewControls
            cookie="projects-view"
            sort={sort}
            view={view}
            options={SORTS.map((s) => ({ value: s, label: S[s] }))}
          />
        ) : null}
      </div>

      {rows.length === 0 ? (
        archived ? (
          <EmptyState title={t.projects.emptyArchived}>{t.projects.emptyArchivedText}</EmptyState>
        ) : (
          <EmptyState
            title={t.projects.empty}
            action={
              <Link href="/projects/new" className="btn-primary">
                <PlusIcon className="h-5 w-5" /> {t.projects.startFirst}
              </Link>
            }
          >
            {t.projects.emptyText}
          </EmptyState>
        )
      ) : (
        <ul
          className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}
          data-testid="projects-list"
          data-layout={view}
        >
          {rows.map(({ p, stats }) => {
            const days = daysUntil(p.deadline);
            const thumb = p.references[0]?.thumbPath;
            const image = thumb ? (
              <img
                src={`/api/uploads/${thumb}`}
                alt=""
                className={view === "grid" ? "aspect-[4/3] w-full object-cover" : "h-20 w-20 shrink-0 rounded-xl object-cover"}
                loading="lazy"
              />
            ) : (
              <div
                className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-100 to-accent-100 font-bold text-brand-700 dark:from-brand-900/60 dark:to-accent-700/30 dark:text-brand-200 ${
                  view === "grid" ? "aspect-[4/3] w-full text-4xl" : "h-20 w-20 rounded-xl text-2xl"
                }`}
              >
                {p.characterName.slice(0, 1).toUpperCase()}
              </div>
            );
            const badge = (
              <span
                className={`shrink-0 rounded-full px-2 text-[11px] font-semibold ${
                  p.publication
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {p.publication ? t.community.statusPublished : t.community.statusPrivate}
              </span>
            );
            const deadline = (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                {p.deadline ? (
                  <span className={days !== null && days < 14 && days >= 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                    {daysLabel(days, t)} · {f.date(p.deadline)}
                  </span>
                ) : (
                  t.days.none
                )}
              </span>
            );

            if (view === "grid") {
              return (
                <li key={p.id} className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="card flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-brand-400 dark:hover:border-brand-600"
                  >
                    {image}
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                      <h2 className="truncate font-semibold">{p.characterName}</h2>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{p.series ?? "—"}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={p.status} label={statusLabel(p.status, t)} />
                        {badge}
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-1">
                        <ProgressBar value={stats.completion} label={t.projects.completionOf(p.characterName)} />
                        <span className="text-xs font-semibold tabular-nums">{stats.completion}%</span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{deadline}</div>
                    </div>
                  </Link>
                </li>
              );
            }
            return (
              <li key={p.id} className="min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="card flex h-full gap-3 transition-colors hover:border-brand-400 dark:hover:border-brand-600"
                >
                  {image}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 truncate font-semibold">{p.characterName}</h2>
                      <span className="shrink-0"><StatusBadge status={p.status} label={statusLabel(p.status, t)} /></span>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="truncate">{p.series ?? "—"}</span>
                      {badge}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={stats.completion} label={t.projects.completionOf(p.characterName)} />
                      <span className="text-xs font-semibold tabular-nums">{stats.completion}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {p.startDate ? <span>{t.projects.startShort(f.date(p.startDate))}</span> : null}
                      {deadline}
                      <span className="tabular-nums">
                        {t.projects.paid(f.money(stats.paid, stats.base))}
                        {p.budgetCents !== null ? ` / ${f.money(p.budgetCents, stats.base)}` : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
