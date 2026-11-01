import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { listPublicProjects } from "@/lib/community/view";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";

// A creator's published projects. The address uses one of their publications,
// so no account id is ever exposed, and only the display name is shown.
async function load(publicationId: string) {
  if (!idSchema.safeParse(publicationId).success) return null;
  return db.publication.findFirst({
    where: { id: publicationId, project: { deletedAt: null } },
    select: { ownerId: true, owner: { select: { name: true } } },
  });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await load(params.id);
  return { title: p ? p.owner.name : getI18n().t.community.notFoundTitle };
}

export default async function CreatorPage({ params, searchParams }: { params: { id: string }; searchParams: { page?: string } }) {
  const creator = await load(params.id);
  if (!creator) notFound();
  const { t } = getI18n();
  const C = t.community;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const result = await listPublicProjects({ sort: "newest", page, ownerId: creator.ownerId });
  return (
    <>
      <BackLink href="/community">{C.back}</BackLink>
      <h1 className="page-title break-words">{creator.owner.name}</h1>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{C.results(result.total)}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="creator-projects">
        {result.items.map((p) => (
          <li key={p.id} className="min-w-0">
            <Link href={`/community/${p.id}`} className="card flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-brand-400">
              {p.cover ? (
                <img src={p.cover.thumbUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-100 to-accent-100 text-4xl font-bold text-brand-700 dark:from-brand-900/60 dark:to-accent-700/30 dark:text-brand-200">
                  {p.title.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 p-3">
                <h2 className="truncate font-semibold">{p.title}</h2>
                {p.series ? <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{p.series}</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {result.pages > 1 ? (
        <nav className="mt-4 flex justify-between gap-2" aria-label={C.title}>
          {page > 1 ? (
            <Link href={`?page=${page - 1}`} className="btn-secondary">
              {C.previous}
            </Link>
          ) : (
            <span />
          )}
          {page < result.pages ? (
            <Link href={`?page=${page + 1}`} className="btn-secondary">
              {C.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
