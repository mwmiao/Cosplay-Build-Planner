import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { ThemePicker } from "@/components/ThemePicker";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { logout } from "../../login/actions";
import { purgeProject, restoreProject } from "../projects/actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [deleted, counts] = await Promise.all([
    db.project.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, characterName: true, series: true, deletedAt: true },
    }),
    Promise.all([
      db.project.count({ where: { deletedAt: null } }),
      db.buildPart.count({ where: { deletedAt: null } }),
      db.referenceImage.count(),
    ]),
  ]);
  const [projectCount, partCount, imageCount] = counts;

  return (
    <>
      <h1 className="page-title mb-4">Settings</h1>

      <section className="card mb-6 space-y-4">
        <ThemePicker />
      </section>

      <section className="card mb-6" aria-labelledby="deleted-title">
        <h2 id="deleted-title" className="section-title mb-1">
          Deleted projects
        </h2>
        <p className="hint mb-3">Restore a project, or delete it for good (its photos are removed too).</p>
        {deleted.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {deleted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.characterName}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {p.series ? `${p.series} · ` : ""}deleted {formatDate(p.deletedAt)}
                  </div>
                </div>
                <form action={restoreProject.bind(null, p.id)}>
                  <SubmitButton className="btn-secondary" pendingText="…">
                    Restore
                  </SubmitButton>
                </form>
                <form action={purgeProject.bind(null, p.id)}>
                  <ConfirmButton message={`Permanently delete “${p.characterName}” and all its parts and photos?`}>
                    Delete forever
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mb-6 text-sm" aria-labelledby="about-title">
        <h2 id="about-title" className="section-title mb-2">
          About this install
        </h2>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-zinc-500 dark:text-zinc-400">Projects</dt>
          <dd className="tabular-nums">{projectCount}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Parts</dt>
          <dd className="tabular-nums">{partCount}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Reference images</dt>
          <dd className="tabular-nums">{imageCount}</dd>
        </dl>
        <p className="hint mt-3">
          Everything lives in the data folder (database, uploads and automatic backups). Back up that folder to keep your
          plans safe.
        </p>
      </section>

      <form action={logout}>
        <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText="Logging out…">
          Log out
        </SubmitButton>
      </form>
    </>
  );
}
