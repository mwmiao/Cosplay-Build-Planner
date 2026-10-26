import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { LightboxGroup, LightboxThumb } from "@/components/Lightbox";
import { Sortable } from "@/components/Sortable";
import { CheckIcon, DownloadIcon, ImageIcon, LinkIcon, PencilIcon, PlusIcon } from "@/components/Icons";
import { EmptyState, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { CATEGORIES, PART_STATUSES, categoryLabel, statusLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { daysLabel, daysUntil, hostname } from "@/lib/format";
import { projectStats } from "@/lib/projects";
import { getMoneyContext, getProjectOr404 } from "@/lib/queries";
import { setProjectArchived } from "../actions";
import { reorderParts, togglePartDone } from "./parts/actions";
import { lightboxImages } from "./references/ImageCard";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  return { title: project.characterName };
}

type Search = { status?: string; category?: string; reorder?: string };

function filterHref(projectId: string, current: Search, change: Search) {
  const next = { ...current, ...change };
  const qs = new URLSearchParams();
  if (next.status) qs.set("status", next.status);
  if (next.category) qs.set("category", next.category);
  if (next.reorder) qs.set("reorder", next.reorder);
  const s = qs.toString();
  return `/projects/${projectId}${s ? `?${s}` : ""}#parts`;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Search & { published?: string; unpublished?: string; copied?: string };
}) {
  const user = await requireUser();
  const project = await getProjectOr404(params.id, user.id);
  const { t, f } = getI18n();
  const P = t.project;
  const [allParts, references, referenceCount, cover, partPhotos] = await Promise.all([
    db.buildPart.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.referenceImage.findMany({
      where: { projectId: project.id, kind: "reference" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    db.referenceImage.count({ where: { projectId: project.id, kind: "reference" } }),
    db.referenceImage.findFirst({ where: { projectId: project.id, kind: "cover" } }),
    db.referenceImage.findMany({
      where: { projectId: project.id, kind: "part" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { partId: true, thumbPath: true },
    }),
  ]);
  // First photo of each part, shown as its thumbnail in the list.
  const partThumb = new Map<string, string>();
  for (const photo of partPhotos) if (photo.partId && !partThumb.has(photo.partId)) partThumb.set(photo.partId, photo.thumbPath);

  const filter: Search = {
    status: (PART_STATUSES as readonly string[]).includes(searchParams.status ?? "") ? searchParams.status : undefined,
    category: (CATEGORIES as readonly string[]).includes(searchParams.category ?? "") ? searchParams.category : undefined,
  };
  const reorder = searchParams.reorder === "1";
  const parts = allParts.filter(
    (p) => (!filter.status || p.status === filter.status) && (!filter.category || p.category === filter.category),
  );
  const usedCategories = CATEGORIES.filter((c) => allParts.some((p) => p.category === c));
  const [publication, moderation] = await Promise.all([
    db.publication.findFirst({
      where: { projectId: project.id, ownerId: user.id },
      select: { id: true, versionAt: true },
    }),
    db.moderationAction.findFirst({
      where: { projectId: project.id, ownerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { reason: true, createdAt: true },
    }),
  ]);
  // Show the latest removal unless the owner has published again since.
  const removedNotice = moderation && (!publication || publication.versionAt < moderation.createdAt) ? moderation : null;
  const ctx = await getMoneyContext(user.id);
  const stats = projectStats(project, allParts, ctx);
  const base = stats.base;
  const days = daysUntil(project.deadline);
  const startDays = daysUntil(project.startDate);
  const over = stats.overUnder !== null && stats.overUnder < 0;

  const C = t.community;
  return (
    <>
      {searchParams.published ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {C.publishedOk}
        </div>
      ) : null}
      {searchParams.copied ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {C.copiedOk}
        </div>
      ) : null}
      {searchParams.unpublished ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {C.unpublishedOk}
        </div>
      ) : null}
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
          {cover ? (
            <div className="w-20 shrink-0 sm:w-28">
              <LightboxGroup images={lightboxImages([cover])}>
                <LightboxThumb index={0} label={t.lightbox.open(project.characterName)} className="rounded-2xl shadow-sm">
                  <img src={`/api/uploads/${cover.thumbPath}`} alt="" className="aspect-square w-full object-cover" data-testid="project-cover" />
                </LightboxThumb>
              </LightboxGroup>
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="page-title break-words">{project.characterName}</h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {[project.series, project.conventionName].filter(Boolean).join(" · ") || P.noSeries}
            </p>
            {project.copiedFromTitle && project.copiedFromCreator ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400" data-testid="attribution">
                {project.copiedFromPublicationId ? (
                  <Link href={`/community/${project.copiedFromPublicationId}`} className="link">
                    {C.basedOn(project.copiedFromTitle, project.copiedFromCreator)}
                  </Link>
                ) : (
                  C.basedOn(project.copiedFromTitle, project.copiedFromCreator)
                )}
              </p>
            ) : null}
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

      <section aria-label={P.summary} className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={P.startDate}
          value={project.startDate ? f.date(project.startDate) : P.noStart}
          sub={startDays === null ? P.startHint : startDays > 0 ? P.startsIn(startDays) : startDays === 0 ? P.startsToday : P.startedAgo(-startDays)}
        />
        <Stat
          label={P.deadline}
          value={<span className={days !== null && days < 14 && days >= 0 ? "text-amber-600 dark:text-amber-400" : ""}>{daysLabel(days, t)}</span>}
          sub={f.date(project.deadline)}
        />
        <div className="col-span-2 sm:col-span-1">
          <Stat label={P.partsDone} value={`${stats.done} / ${stats.count}`} sub={P.percentComplete(stats.completion)} />
        </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="parts-title" className="section-title">
            {P.parts}
          </h2>
          <div className="flex shrink-0 gap-2">
            {allParts.length > 1 ? (
              <Link
                href={filterHref(project.id, { ...filter, reorder: reorder ? undefined : "1" }, {})}
                className={reorder ? "btn-primary" : "btn-secondary"}
                aria-pressed={reorder}
              >
                {reorder ? P.doneReordering : P.reorderParts}
              </Link>
            ) : null}
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
        ) : reorder && parts.length > 1 ? (
          <Sortable
            onSave={reorderParts.bind(null, project.id)}
            items={parts.map((part) => ({
              id: part.id,
              label: part.name,
              content: (
                <div className="flex min-w-0 items-center gap-2">
                  {partThumb.get(part.id) ? (
                    <img src={`/api/uploads/${partThumb.get(part.id)}`} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" draggable={false} />
                  ) : null}
                  <span className="truncate font-medium">{part.name}</span>
                  <StatusBadge status={part.status} label={statusLabel(part.status, t)} />
                </div>
              ),
            }))}
          />
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
                  {partThumb.get(part.id) ? (
                    <Link href={`/projects/${project.id}/parts/${part.id}/edit#photos`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                      <img src={`/api/uploads/${partThumb.get(part.id)}`} alt="" loading="lazy" className="h-12 w-12 rounded-xl object-cover" />
                    </Link>
                  ) : null}
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

      <section aria-labelledby="community-title" className="card mb-6" data-testid="community-card">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="community-title" className="section-title">
            {C.title}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              publication
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {publication ? C.statusPublished : C.statusPrivate}
          </span>
        </div>
        <p className="hint mb-3">
          {publication ? C.cardPublishedLive : C.cardPrivate}
        </p>
        {removedNotice ? (
          <p role="alert" data-testid="moderation-notice" className="mb-3 whitespace-pre-wrap break-words rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {t.admin.ownerNotice(f.date(removedNotice.createdAt), removedNotice.reason)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {user.isGuest ? (
            <>
              <p className="hint w-full">{t.guest.publishNeedsAccount}</p>
              <Link href="/register" className="btn-primary">
                {t.guest.createAccount}
              </Link>
            </>
          ) : (
            <Link href={`/projects/${project.id}/publish`} className={publication ? "btn-secondary" : "btn-primary"}>
              {publication ? C.manage : C.publishTitle}
            </Link>
          )}
          {publication ? (
            <Link href={`/community/${publication.id}`} className="btn-ghost">
              {C.viewPublic}
            </Link>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="export-title" className="card mb-8">
        <h2 id="export-title" className="section-title mb-1">
          {t.transfer.exportTitle}
        </h2>
        <p className="hint mb-3">{t.transfer.exportHint}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/export/projects/${project.id}/json`} className="btn-secondary" download>
            <DownloadIcon className="h-5 w-5" /> {t.transfer.exportJson}
          </a>
          <a href={`/api/export/projects/${project.id}/budget`} className="btn-ghost" download aria-label={P.exportBudget}>
            <DownloadIcon className="h-5 w-5" /> {t.transfer.exportCsv}
          </a>
        </div>
      </section>

      <section aria-labelledby="refs-title" className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="refs-title" className="section-title">
            {P.references}
          </h2>
          <Link href={`/projects/${project.id}/references`} className="btn-secondary">
            <ImageIcon className="h-5 w-5" /> {referenceCount ? P.allPhotosCount(referenceCount) : P.addPhotos}
          </Link>
        </div>
        {references.length === 0 ? (
          <EmptyState title={P.noRefs}>{P.noRefsText}</EmptyState>
        ) : (
          <LightboxGroup images={lightboxImages(references)}>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {references.map((r, i) => (
                <li key={r.id}>
                  <LightboxThumb index={i} label={t.lightbox.open(r.caption ?? P.refAlt)}>
                    <img
                      src={`/api/uploads/${r.thumbPath}`}
                      alt={r.caption ?? P.refAlt}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </LightboxThumb>
                </li>
              ))}
            </ul>
          </LightboxGroup>
        )}
      </section>
    </>
  );
}
