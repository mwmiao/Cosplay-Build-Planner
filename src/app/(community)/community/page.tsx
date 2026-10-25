import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ProgressBar } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { type CommunitySort, listPublicProjects } from "@/lib/community/view";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.community.title };
}

type Search = { q?: string; sort?: string; page?: string };

export default async function CommunityPage({ searchParams }: { searchParams: Search }) {
  const { t, f } = getI18n();
  const C = t.community;
  const q = typeof searchParams.q === "string" ? searchParams.q.slice(0, 100) : "";
  const sort: CommunitySort = searchParams.sort === "updated" ? "updated" : "newest";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const result = await listPublicProjects({ q, sort, page });

  const href = (change: Partial<{ q: string; sort: CommunitySort; page: number }>) => {
    const next = { q, sort, page, ...change };
    const qs = new URLSearchParams();
    if (next.q) qs.set("q", next.q);
    if (next.sort !== "newest") qs.set("sort", next.sort);
    if (next.page > 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return `/community${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <h1 className="page-title">{C.title}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{C.intro}</p>

      <form method="get" action="/community" className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="community-q" className="label">
            {C.searchLabel}
          </label>
          <input id="community-q" name="q" type="search" defaultValue={q} placeholder={C.searchPlaceholder} className="input" />
        </div>
        <div>
          <label htmlFor="community-sort" className="label">
            {C.sortLabel}
          </label>
          <select id="community-sort" name="sort" defaultValue={sort} className="input">
            <option value="newest">{C.sortNewest}</option>
            <option value="updated">{C.sortUpdated}</option>
          </select>
        </div>
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
          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {C.results(result.total)}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="community-list">
            {result.items.map((p) => (
              <li key={p.id} className="min-w-0">
                <Link href={`/community/${p.id}`} className="card flex h-full gap-3 transition-colors hover:border-brand-400">
                  {p.cover ? (
                    <img src={p.cover.thumbUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                      {p.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
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
                      <span>{sort === "updated" ? C.updated(f.date(new Date(p.updatedAt))) : C.published(f.date(new Date(p.publishedAt)))}</span>
                      {p.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
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
