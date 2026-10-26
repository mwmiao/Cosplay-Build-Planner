import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ProgressBar } from "@/components/ui";
import { ViewControls } from "@/components/ViewControls";
import { getI18n } from "@/i18n/server";
import { COMMUNITY_SORTS, type CommunitySort, listPublicProjects } from "@/lib/community/view";
import { viewPrefs } from "@/lib/viewPrefs";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.community.title };
}

type Search = { q?: string; sort?: string; layout?: string; page?: string };

export default async function CommunityPage({ searchParams }: { searchParams: Search }) {
  const { t, f } = getI18n();
  const C = t.community;
  const q = typeof searchParams.q === "string" ? searchParams.q.slice(0, 100) : "";
  const { sort, view } = viewPrefs<CommunitySort>("community-view", searchParams, COMMUNITY_SORTS, { sort: "newest", view: "list" });
  const page = Math.max(1, Math.min(10_000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const result = await listPublicProjects({ q, sort, page });

  const href = (change: Partial<{ q: string; page: number }>) => {
    const next = { q, page, ...change };
    const qs = new URLSearchParams();
    if (next.q) qs.set("q", next.q);
    if (searchParams.sort) qs.set("sort", sort);
    if (searchParams.layout) qs.set("layout", view);
    if (next.page > 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return `/community${s ? `?${s}` : ""}`;
  };
  const dateLine = (p: { updatedAt: string; publishedAt: string }) =>
    sort === "updated" ? C.updated(f.date(new Date(p.updatedAt))) : C.published(f.date(new Date(p.publishedAt)));

  return (
    <>
      <h1 className="page-title">{C.title}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{C.intro}</p>

      <form method="get" action="/community" className="mb-3 flex flex-wrap items-end gap-2" role="search">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="community-q" className="label">
            {C.searchLabel}
          </label>
          <input id="community-q" name="q" type="search" defaultValue={q} placeholder={C.searchPlaceholder} className="input" />
        </div>
        {searchParams.sort ? <input type="hidden" name="sort" value={sort} /> : null}
        {searchParams.layout ? <input type="hidden" name="layout" value={view} /> : null}
        <button type="submit" className="btn-primary">
          {C.search}
        </button>
      </form>

      {result.total === 0 ? (
        q ? (
          <EmptyState
            title={C.noResults}
            action={
              <Link href="/community" className="btn-secondary">
                {C.clearSearch}
              </Link>
            }
          />
        ) : (
          <EmptyState title={C.empty}>{C.emptyText}</EmptyState>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {C.results(result.total)}
            </p>
            <ViewControls
              cookie="community-view"
              sort={sort}
              view={view}
              options={COMMUNITY_SORTS.map((s) => ({ value: s, label: C.sorts[s] }))}
            />
          </div>
          <ul
            className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}
            data-testid="community-list"
            data-layout={view}
          >
            {result.items.map((p) => {
              const image = p.cover ? (
                <img
                  src={p.cover.thumbUrl}
                  alt=""
                  loading="lazy"
                  className={view === "grid" ? "aspect-[4/3] w-full object-cover" : "h-24 w-24 shrink-0 rounded-xl object-cover"}
                />
              ) : (
                <div
                  className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-brand-100 to-accent-100 font-bold text-brand-700 dark:from-brand-900/60 dark:to-accent-700/30 dark:text-brand-200 ${
                    view === "grid" ? "aspect-[4/3] w-full text-4xl" : "h-24 w-24 rounded-xl text-2xl"
                  }`}
                >
                  {p.title.slice(0, 1).toUpperCase()}
                </div>
              );
              if (view === "grid") {
                return (
                  <li key={p.id} className="min-w-0">
                    <Link href={`/community/${p.id}`} className="card flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-brand-400">
                      {image}
                      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                        <h2 className="truncate font-semibold">{p.title}</h2>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {[p.series, C.byCreator(p.creator.displayName)].filter(Boolean).join(" · ")}
                        </p>
                        <div className="mt-auto flex items-center gap-2 pt-1">
                          <ProgressBar value={p.progressPercent} label={C.progress(p.progressPercent)} />
                          <span className="text-xs font-semibold tabular-nums">{p.progressPercent}%</span>
                        </div>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{dateLine(p)}</p>
                      </div>
                    </Link>
                  </li>
                );
              }
              return (
                <li key={p.id} className="min-w-0">
                  <Link href={`/community/${p.id}`} className="card flex h-full gap-3 transition-colors hover:border-brand-400">
                    {image}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{p.title}</h2>
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {[p.series, C.byCreator(p.creator.displayName)].filter(Boolean).join(" · ")}
                      </p>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">{p.description}</p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={p.progressPercent} label={C.progress(p.progressPercent)} />
                        <span className="text-xs font-semibold tabular-nums">{p.progressPercent}%</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{dateLine(p)}</span>
                        {p.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {result.pages > 1 ? (
            <nav aria-label={C.pagination} className="mt-6 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className="btn-secondary" rel="prev">
                  {C.previous}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-zinc-500">{C.pageOf(page, result.pages)}</span>
              {page < result.pages ? (
                <Link href={href({ page: page + 1 })} className="btn-secondary" rel="next">
                  {C.next}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
