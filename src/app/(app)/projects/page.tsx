import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, PlusIcon } from "@/components/Icons";
import { EmptyState, ProgressBar, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { daysLabel, daysUntil, formatDate, money } from "@/lib/format";
import { projectStats } from "@/lib/projects";
import { getMoneyContext } from "@/lib/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const archived = searchParams.view === "archived";
  const projects = await db.project.findMany({
    where: { deletedAt: null, archivedAt: archived ? { not: null } : null },
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
      references: { take: 1, orderBy: { createdAt: "asc" }, select: { thumbPath: true } },
    },
    // Soonest deadline first; projects without one go last.
    orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
  });

  const ctx = await getMoneyContext();

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="page-title">{archived ? "Archived projects" : "Projects"}</h1>
        <Link href="/projects/new" className="btn-primary hidden md:inline-flex">
          <PlusIcon className="h-5 w-5" /> New project
        </Link>
      </header>

      <div className="mb-4 flex gap-2" role="group" aria-label="Show">
        <Link href="/projects" className={archived ? "chip-off" : "chip-on"} aria-current={!archived ? "page" : undefined}>
          Active
        </Link>
        <Link
          href="/projects?view=archived"
          className={archived ? "chip-on" : "chip-off"}
          aria-current={archived ? "page" : undefined}
        >
          Archived
        </Link>
      </div>

      {projects.length === 0 ? (
        archived ? (
          <EmptyState title="No archived projects">Archive a finished project to tidy up your list.</EmptyState>
        ) : (
          <EmptyState
            title="No projects yet"
            action={
              <Link href="/projects/new" className="btn-primary">
                <PlusIcon className="h-5 w-5" /> Start your first build
              </Link>
            }
          >
            Plan a cosplay: parts, costs, deadline and reference photos.
          </EmptyState>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const stats = projectStats(p, p.parts, ctx);
            const days = daysUntil(p.deadline);
            const thumb = p.references[0]?.thumbPath;
            return (
              <li key={p.id} className="min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="card flex h-full gap-3 transition-colors hover:border-brand-400 dark:hover:border-brand-600"
                >
                  {thumb ? (
                    <img
                      src={`/api/uploads/${thumb}`}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                      {p.characterName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 truncate font-semibold">{p.characterName}</h2>
                      <span className="shrink-0"><StatusBadge status={p.status} /></span>
                    </div>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{p.series ?? "—"}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={stats.completion} label={`${p.characterName} completion`} />
                      <span className="text-xs font-semibold tabular-nums">{stats.completion}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {p.deadline ? (
                          <span className={days !== null && days < 14 && days >= 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                            {daysLabel(days)} · {formatDate(p.deadline)}
                          </span>
                        ) : (
                          "No deadline"
                        )}
                      </span>
                      <span className="tabular-nums">
                        {money(stats.paid, stats.base)} paid
                        {p.budgetCents !== null ? ` / ${money(p.budgetCents, stats.base)}` : ""}
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
