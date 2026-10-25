// Renders a public project. Used for the publish preview (client) and the
// public Community page (server), so the preview is exactly what visitors see.
// No hooks: the caller passes the dictionary and formatters. All user text is
// rendered as plain text (React escapes it); links open with rel=nofollow.
import type { Dict } from "@/i18n";
import type { PublicSnapshot } from "@/lib/community/snapshot";
import type { Formatters } from "@/lib/format";
import { ProgressBar, StatusBadge } from "./ui";

export type PublicProjectData = {
  title: string;
  series: string | null;
  description: string | null;
  tags: string[];
  creatorName: string;
  publishedAt?: string;
  updatedAt?: string;
  version?: number;
  snapshot: PublicSnapshot;
  images: { id: string; caption: string | null; thumbUrl: string; fullUrl?: string }[];
  coverId: string | null;
};

export function PublicProject({
  data,
  t,
  f,
  actions,
}: {
  data: PublicProjectData;
  t: Dict;
  f: Formatters;
  actions?: React.ReactNode;
}) {
  const C = t.community;
  const s = data.snapshot;
  const cover = data.images.find((i) => i.id === data.coverId) ?? data.images[0] ?? null;
  return (
    <article className="space-y-6" data-testid="public-project">
      {cover ? (
        <img
          src={cover.fullUrl ?? cover.thumbUrl}
          alt={cover.caption ?? data.title}
          className="max-h-80 w-full rounded-2xl object-cover"
        />
      ) : null}

      <header className="space-y-2">
        <h1 className="page-title break-words">{data.title}</h1>
        {data.series ? <p className="text-zinc-500 dark:text-zinc-400">{data.series}</p> : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{C.byCreator(data.creatorName)}</p>
        {data.publishedAt ? (
          <p className="hint">
            {C.published(f.date(new Date(data.publishedAt)))}
            {data.updatedAt && data.updatedAt !== data.publishedAt ? ` · ${C.updated(f.date(new Date(data.updatedAt)))}` : ""}
            {data.version ? ` · ${C.version(data.version)}` : ""}
          </p>
        ) : null}
        {data.tags.length ? (
          <ul className="flex flex-wrap gap-2" aria-label={C.tags}>
            {data.tags.map((tag) => (
              <li key={tag} className="chip-off min-h-7 text-xs">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center gap-3 pt-1">
          <StatusBadge status={s.status} label={t.status[s.status] ?? s.status} />
          <div className="flex flex-1 items-center gap-2">
            <ProgressBar value={s.progress.percent} label={C.progress(s.progress.percent)} />
            <span className="text-sm font-semibold tabular-nums">{C.progress(s.progress.percent)}</span>
          </div>
        </div>
        {actions}
      </header>

      {data.description ? (
        <section className="card">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{C.about}</h2>
          <p className="whitespace-pre-wrap break-words text-sm">{data.description}</p>
        </section>
      ) : null}

      {s.budget ? (
        <section aria-label={C.budget} className="grid grid-cols-3 gap-3">
          <div className="card p-3">
            <div className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{C.budgetPlanned}</div>
            <div className="mt-1 font-bold tabular-nums">{f.money(s.budget.budgetCents, s.budget.currency)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{C.spent}</div>
            <div className="mt-1 font-bold tabular-nums">{f.money(s.budget.spentCents, s.budget.currency)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{C.stillPlanned}</div>
            <div className="mt-1 font-bold tabular-nums">{f.money(s.budget.plannedCents, s.budget.currency)}</div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="public-items">
        <h2 id="public-items" className="section-title mb-2">
          {C.items} <span className="text-sm font-normal text-zinc-500">({C.itemCount(s.items.length)})</span>
        </h2>
        <ul className="space-y-2">
          {s.items.map((item, i) => (
            <li key={i} className="card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words">
                    {item.name}
                    {item.quantity > 1 ? <span className="text-zinc-500"> ×{item.quantity}</span> : null}
                  </span>
                  <StatusBadge status={item.status} label={t.status[item.status] ?? item.status} />
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{t.category[item.category] ?? item.category}</span>
                  {item.supplier ? <span>{item.supplier}</span> : null}
                  {item.estimatedEachCents != null && item.currency ? (
                    <span className="tabular-nums">{C.estEach(f.money(item.estimatedEachCents, item.currency))}</span>
                  ) : null}
                </div>
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer ugc"
                  className="btn-ghost shrink-0 text-sm"
                  aria-label={C.openShop(item.name)}
                >
                  ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {data.images.length ? (
        <section aria-labelledby="public-images">
          <h2 id="public-images" className="section-title mb-2">
            {C.images}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.images.map((img) => (
              <li key={img.id}>
                <a href={img.fullUrl ?? img.thumbUrl} target="_blank" rel="noopener" className="block">
                  <img
                    src={img.thumbUrl}
                    alt={img.caption ?? data.title}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                </a>
                {img.caption ? <p className="mt-1 text-xs">{img.caption}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
