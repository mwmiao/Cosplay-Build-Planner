import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureBuiltinData } from "@/lib/events/builtinSync";
import { instagramConfig } from "@/lib/events/instagram";
import { saveOrganiser } from "../events/actions";
import { OrganiserForm } from "./OrganiserForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.organisers.title };
}

/** Recurring events / organisers. Their Instagram accounts are checked daily for new dates. */
export default async function OrganisersPage() {
  await requireAdmin();
  await ensureBuiltinData();
  const { t, f } = getI18n();
  const O = t.organisers;
  const organisers = await db.organiser.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { events: true } } } });
  return (
    <>
      <BackLink href="/admin/events">{t.events.queueTitle}</BackLink>
      <h1 className="page-title mb-1">{O.title}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{O.intro}</p>
      {instagramConfig() ? null : (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{O.notSetUp}</p>
      )}

      <ul className="mb-8 space-y-2" data-testid="organisers">
        {organisers.map((o) => (
          <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.name}</span>
                {o.active ? null : <span className="rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800">{O.paused}</span>}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {[o.instagram ? `@${o.instagram}` : O.noInstagram, o.city, o.usualVenue].filter(Boolean).join(" · ")}
              </p>
              {o.lastCheckedAt ? (
                <p className={`text-xs ${o.lastError ? "text-red-700 dark:text-red-400" : "text-zinc-500"}`}>
                  {o.lastError ? O.lastError(o.lastError) : O.lastChecked(f.dateTime(o.lastCheckedAt))}
                </p>
              ) : null}
            </div>
            <Link href={`/admin/organisers/${o.id}`} className="btn-secondary min-h-9">
              {t.common.edit}
            </Link>
          </li>
        ))}
      </ul>

      <section className="card" aria-labelledby="new-organiser">
        <h2 id="new-organiser" className="section-title mb-3">
          {O.add}
        </h2>
        <OrganiserForm action={saveOrganiser.bind(null, null)} submitLabel={O.add} />
      </section>
    </>
  );
}
