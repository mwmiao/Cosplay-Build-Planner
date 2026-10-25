import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { RemoveForm } from "./RemoveForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.admin.title };
}

export default async function AdminPage({ searchParams }: { searchParams: { removed?: string } }) {
  await requireAdmin();
  const { t, f } = getI18n();
  const A = t.admin;
  const [publications, log] = await Promise.all([
    db.publication.findMany({
      where: { project: { deletedAt: null } },
      orderBy: { versionAt: "desc" },
      select: { id: true, title: true, versionAt: true, owner: { select: { name: true } } },
      take: 200,
    }),
    db.moderationAction.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <>
      <h1 className="page-title">{A.title}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{A.intro}</p>
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
          <p className="text-sm text-zinc-500">{A.none}</p>
        ) : (
          <ul className="space-y-3">
            {publications.map((p) => (
              <li key={p.id} id={`pub-${p.id}`} className="card space-y-2" data-testid="moderation-item">
                <div>
                  <Link href={`/community/${p.id}`} className="link font-semibold">
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
          <p className="text-sm text-zinc-500">{A.logEmpty}</p>
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
