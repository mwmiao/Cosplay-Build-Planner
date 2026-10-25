import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { CheckIcon, DownloadIcon, ImageIcon, LinkIcon, PencilIcon, PlusIcon } from "@/components/Icons";
import { EmptyState, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { CATEGORIES, PART_STATUSES, categoryLabel, statusLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { daysLabel, daysUntil, formatDate, hostname, money } from "@/lib/format";
import { projectStats } from "@/lib/projects";
import { getProjectOr404 } from "@/lib/queries";
import { setProjectArchived } from "../actions";
import { togglePartDone } from "./parts/actions";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const project = await getProjectOr404(params.id);
  return { title: project.characterName };
}

type Search = { status?: string; category?: string };

function filterHref(projectId: string, current: Search, change: Search) {
  const next = { ...current, ...change };
  const qs = new URLSearchParams();
  if (next.status) qs.set("status", next.status);
  if (next.category) qs.set("category", next.category);
  const s = qs.toString();
  return `/projects/${projectId}${s ? `?${s}` : ""}#parts`;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Search;
}) {
  const project = await getProjectOr404(params.id);
  const [allParts, references] = await Promise.all([
    db.buildPart.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.referenceImage.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const filter: Search = {
    status: (PART_STATUSES as readonly string[]).includes(searchParams.status ?? "") ? searchParams.status : undefined,
    category: (CATEGORIES as readonly string[]).includes(searchParams.category ?? "") ? searchParams.category : undefined,
  };
  const parts = allParts.filter(
    (p) => (!filter.status || p.status === filter.status) && (!filter.category || p.category === filter.category),
  );
  const usedCategories = CATEGORIES.filter((c) => allParts.some((p) => p.category === c));
  const stats = projectStats(project, allParts);
  const days = daysUntil(project.deadline);
  const overBudget = stats.remainingBudget !== null && stats.remainingBudget < 0;

  return (
    <>
      {project.archivedAt ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>This project is archived.</span>
          <form action={setProjectArchived.bind(null, project.id, false)}>
            <SubmitButton className="btn-secondary min-h-9" pendingText="…">
              Unarchive
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title break-words">{project.characterName}</h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {[project.series, project.conventionName].filter(Boolean).join(" · ") || "No series set"}
            </p>
          </div>
          <Link href={`/projects/${project.id}/edit`} className="btn-secondary shrink-0" aria-label="Edit project">
            <PencilIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <StatusBadge status={project.status} />
          <div className="flex flex-1 items-center gap-2">
            <ProgressBar value={stats.completion} label="Project completion" />
            <span className="text-sm font-semibold tabular-nums">{stats.completion}%</span>
          </div>
        </div>
      </header>

      <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Deadline"
          value={<span className={days !== null && days < 14 && days >= 0 ? "text-amber-600 dark:text-amber-400" : ""}>{daysLabel(days)}</span>}
          sub={formatDate(project.deadline)}
        />
        <Stat label="Parts done" value={`${stats.done} / ${stats.count}`} sub={`${stats.completion}% complete`} />
        <Stat
          label="Spent"
          value={<span className={overBudget ? "text-red-600 dark:text-red-400" : ""}>{money(stats.spent)}</span>}
          sub={
            project.budgetCents !== null
              ? `${overBudget ? "Over" : "Left"}: ${money(Math.abs(stats.remainingBudget ?? 0))} of ${money(project.budgetCents)}`
              : stats.spentIsManual
                ? "Entered manually"
                : "No budget set"
          }
        />
        <Stat label="Estimated" value={money(stats.estimated)} sub={`Actual so far ${money(stats.actual)}`} />
      </section>

      {project.notes ? (
        <section className="card mb-6">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{project.notes}</p>
        </section>
      ) : null}

      <section id="parts" aria-labelledby="parts-title" className="mb-8 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="parts-title" className="section-title">
            Build parts
          </h2>
          <div className="flex gap-2">
            <a href={`/api/export/projects/${project.id}/budget`} className="btn-ghost" aria-label="Export budget as CSV">
              <DownloadIcon className="h-5 w-5" />
              <span className="hidden sm:inline">CSV</span>
            </a>
            <Link href={`/projects/${project.id}/parts/new`} className="btn-primary">
              <PlusIcon className="h-5 w-5" /> Add part
            </Link>
          </div>
        </div>

        {allParts.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by status">
              <Link href={filterHref(project.id, filter, { status: undefined })} className={!filter.status ? "chip-on" : "chip-off"}>
                All statuses
              </Link>
              {PART_STATUSES.map((s) => (
                <Link key={s} href={filterHref(project.id, filter, { status: s })} className={filter.status === s ? "chip-on" : "chip-off"}>
                  {statusLabel(s)} ({allParts.filter((p) => p.status === s).length})
                </Link>
              ))}
            </div>
            {usedCategories.length > 1 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
                <Link href={filterHref(project.id, filter, { category: undefined })} className={!filter.category ? "chip-on" : "chip-off"}>
                  All categories
                </Link>
                {usedCategories.map((c) => (
                  <Link key={c} href={filterHref(project.id, filter, { category: c })} className={filter.category === c ? "chip-on" : "chip-off"}>
                    {categoryLabel(c)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {allParts.length === 0 ? (
          <EmptyState
            title="No parts yet"
            action={
              <Link href={`/projects/${project.id}/parts/new`} className="btn-primary">
                <PlusIcon className="h-5 w-5" /> Add the first part
              </Link>
            }
          >
            Break the costume into pieces: wig, armor, props, fabric, shoes…
          </EmptyState>
        ) : parts.length === 0 ? (
          <EmptyState title="No parts match these filters">
            <Link href={`/projects/${project.id}#parts`} className="link">
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {parts.map((part) => {
              const done = part.status === "done";
              const site = hostname(part.url);
              return (
                <li key={part.id} className="card flex items-center gap-3 p-3">
                  <form action={togglePartDone.bind(null, project.id, part.id)}>
                    <button
                      type="submit"
                      aria-pressed={done}
                      aria-label={done ? `Mark ${part.name} as not done` : `Mark ${part.name} as done`}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-zinc-300 text-transparent hover:border-green-600 hover:text-green-600 dark:border-zinc-600"
                      }`}
                    >
                      <CheckIcon className="h-5 w-5" />
                    </button>
                  </form>
                  <Link href={`/projects/${project.id}/parts/${part.id}/edit`} className="min-w-0 flex-1 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${done ? "text-zinc-400 line-through dark:text-zinc-500" : ""}`}>
                        {part.name}
                        {part.quantity > 1 ? <span className="text-zinc-500"> ×{part.quantity}</span> : null}
                      </span>
                      <StatusBadge status={part.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{categoryLabel(part.category)}</span>
                      {part.supplier || site ? <span>{part.supplier ?? site}</span> : null}
                      <span className="tabular-nums">
                        est {money(part.estimatedCostCents === null ? null : part.estimatedCostCents * part.quantity)}
                        {part.actualCostCents !== null ? ` · paid ${money(part.actualCostCents * part.quantity)}` : ""}
                      </span>
                    </div>
                  </Link>
                  {part.url ? (
                    <a
                      href={part.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost h-11 w-11 shrink-0 px-0"
                      aria-label={`Open link for ${part.name}`}
                    >
                      <LinkIcon className="h-5 w-5" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="refs-title" className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="refs-title" className="section-title">
            References
          </h2>
          <Link href={`/projects/${project.id}/references`} className="btn-secondary">
            <ImageIcon className="h-5 w-5" /> {references.length ? "All photos" : "Add photos"}
          </Link>
        </div>
        {references.length === 0 ? (
          <EmptyState title="No reference images">Upload screenshots, art and progress photos.</EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {references.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${project.id}/references#ref-${r.id}`}>
                  <img
                    src={`/api/uploads/${r.thumbPath}`}
                    alt={r.caption ?? "Reference image"}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
