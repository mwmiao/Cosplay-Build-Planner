import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { CheckIcon, DownloadIcon, ImageIcon, LinkIcon, PencilIcon, PlusIcon } from "@/components/Icons";
import { EmptyState, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { CATEGORIES, PART_STATUSES, categoryLabel, statusLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { daysLabel, daysUntil, hostname } from "@/lib/format";
import { projectStats } from "@/lib/projects";
import { getMoneyContext, getProjectOr404 } from "@/lib/queries";
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
  const { t, f } = getI18n();
  const P = t.project;
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
  const ctx = await getMoneyContext();
  const stats = projectStats(project, allParts, ctx);
  const base = stats.base;
  const days = daysUntil(project.deadline);
  const over = stats.overUnder !== null && stats.overUnder < 0;

  return (
    <>
      {project.archivedAt ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>{P.archivedBanner}</span>
          <form action={setProjectArchived.bind(null, project.id, false)}>
            <SubmitButton className="btn-secondary min-h-9" pendingText="…">
              {P.unarchive}
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title break-words">{project.characterName}</h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {[project.series, project.conventionName].filter(Boolean).join(" · ") || P.noSeries}
            </p>
          </div>
          <Link href={`/projects/${project.id}/edit`} className="btn-secondary shrink-0" aria-label={P.editProject}>
            <PencilIcon className="h-5 w-5" />
            <span className="hidden sm:inline">{t.common.edit}</span>
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <StatusBadge status={project.status} label={statusLabel(project.status, t)} />
          <div className="flex flex-1 items-center gap-2">
            <ProgressBar value={stats.completion} label={P.completion} />
            <span className="text-sm font-semibold tabular-nums">{stats.completion}%</span>
          </div>
        </div>
      </header>

      <section aria-label={P.summary} className="mb-3 grid grid-cols-2 gap-3">
        <Stat
          label={P.deadline}
          value={<span className={days !== null && days < 14 && days >= 0 ? "text-amber-600 dark:text-amber-400" : ""}>{daysLabel(days, t)}</span>}
          sub={f.date(project.deadline)}
        />
        <Stat label={P.partsDone} value={`${stats.done} / ${stats.count}`} sub={P.percentComplete(stats.completion)} />
      </section>

      <section aria-labelledby="budget-title" className="mb-6">
        <h2 id="budget-title" className="sr-only">
          {P.budgetIn(base)}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={P.paid} value={f.money(stats.paid, base)} sub={P.payments(stats.paidCount)} />
          <Stat
            label={P.planned}
            value={`${stats.plannedConverted ? "≈ " : ""}${f.money(stats.planned, base)}`}
            sub={stats.plannedConverted ? P.stillToPayRates : P.stillToPay}
          />
          <Stat
            label={P.budgetLeft}
            value={stats.remaining === null ? "—" : f.money(stats.remaining, base)}
            sub={stats.budget === null ? P.noBudget : P.budgetMinusPaid(f.money(stats.budget, base))}
          />
          <Stat
            label={over ? P.overBudget : P.underBudget}
            value={
              stats.overUnder === null ? (
                "—"
              ) : (
                <span className={over ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
                  {stats.plannedConverted ? "≈ " : ""}
                  {f.money(Math.abs(stats.overUnder), base)}
                </span>
              )
            }
            sub={P.ifPlannedHolds(f.money(stats.projected, base))}
          />
        </div>
        <p className="hint mt-2">
          {P.totalsNote(base)}
          {stats.plannedConverted && ctx.rates.rateDate ? P.plannedRatesNote(ctx.rates.rateDate) : ""}
        </p>
        {stats.missingRates.length ? (
          <p role="alert" className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {P.missingRates(stats.missingRates.join(", "))}
          </p>
        ) : null}
      </section>

      {project.notes ? (
        <section className="card mb-6">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{P.notes}</h2>
          <p className="whitespace-pre-wrap text-sm">{project.notes}</p>
        </section>
      ) : null}

      <section id="parts" aria-labelledby="parts-title" className="mb-8 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="parts-title" className="section-title">
            {P.parts}
          </h2>
          <div className="flex gap-2">
            <a href={`/api/export/projects/${project.id}/budget`} className="btn-ghost" aria-label={P.exportBudget}>
              <DownloadIcon className="h-5 w-5" />
              <span className="hidden sm:inline">{t.common.csv}</span>
            </a>
            <Link href={`/projects/${project.id}/parts/new`} className="btn-primary">
              <PlusIcon className="h-5 w-5" /> {P.addPart}
            </Link>
          </div>
        </div>

        {allParts.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={P.filterStatus}>
              <Link href={filterHref(project.id, filter, { status: undefined })} className={!filter.status ? "chip-on" : "chip-off"}>
                {P.allStatuses}
              </Link>
              {PART_STATUSES.map((s) => (
                <Link key={s} href={filterHref(project.id, filter, { status: s })} className={filter.status === s ? "chip-on" : "chip-off"}>
                  {statusLabel(s, t)} ({allParts.filter((p) => p.status === s).length})
                </Link>
              ))}
            </div>
            {usedCategories.length > 1 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={P.filterCategory}>
                <Link href={filterHref(project.id, filter, { category: undefined })} className={!filter.category ? "chip-on" : "chip-off"}>
                  {P.allCategories}
                </Link>
                {usedCategories.map((c) => (
                  <Link key={c} href={filterHref(project.id, filter, { category: c })} className={filter.category === c ? "chip-on" : "chip-off"}>
                    {categoryLabel(c, t)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {allParts.length === 0 ? (
          <EmptyState
            title={P.noParts}
            action={
              <Link href={`/projects/${project.id}/parts/new`} className="btn-primary">
                <PlusIcon className="h-5 w-5" /> {P.addFirstPart}
              </Link>
            }
          >
            {P.noPartsText}
          </EmptyState>
        ) : parts.length === 0 ? (
          <EmptyState title={P.noMatch}>
            <Link href={`/projects/${project.id}#parts`} className="link">
              {P.clearFilters}
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
                      aria-label={done ? P.markNotDone(part.name) : P.markDone(part.name)}
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
                      <StatusBadge status={part.status} label={statusLabel(part.status, t)} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{categoryLabel(part.category, t)}</span>
                      {part.supplier || site ? <span>{part.supplier ?? site}</span> : null}
                      {(() => {
                        const cur = part.currency ?? base;
                        if (part.paidAt && part.paidBaseCents !== null) {
                          const original = part.actualCostCents === null ? null : part.actualCostCents * part.quantity;
                          return (
                            <span className="tabular-nums font-medium text-green-700 dark:text-green-400">
                              {P.paidAmount(f.money(part.paidBaseCents, base))}
                              {cur !== base ? ` (${f.money(original, cur)})` : ""} · {f.date(part.paidAt)}
                            </span>
                          );
                        }
                        const each = part.actualCostCents ?? part.estimatedCostCents;
                        if (each === null) return <span>{P.noCost}</span>;
                        return (
                          <span className="tabular-nums">
                            {(part.actualCostCents !== null ? P.toPay : P.estimate)(f.money(each * part.quantity, cur))}
                          </span>
                        );
                      })()}
                    </div>
                  </Link>
                  {part.url ? (
                    <a
                      href={part.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost h-11 w-11 shrink-0 px-0"
                      aria-label={P.openLink(part.name)}
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
            {P.references}
          </h2>
          <Link href={`/projects/${project.id}/references`} className="btn-secondary">
            <ImageIcon className="h-5 w-5" /> {references.length ? P.allPhotos : P.addPhotos}
          </Link>
        </div>
        {references.length === 0 ? (
          <EmptyState title={P.noRefs}>{P.noRefsText}</EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {references.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${project.id}/references#ref-${r.id}`}>
                  <img
                    src={`/api/uploads/${r.thumbPath}`}
                    alt={r.caption ?? P.refAlt}
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
