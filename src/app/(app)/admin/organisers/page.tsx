import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureBuiltinData } from "@/lib/events/builtinSync";
import { monitorEnabled, pollIntervalMinutes } from "@/lib/instagram/monitor";
import { PROVIDERS, getProvider, rssBridgeReachable } from "@/lib/instagram/providers";
import { saveOrganiser } from "../events/actions";
import { addManualPostAction, checkAllSources, checkSourceNow, saveSource, testSourceFeed } from "../instagram/actions";
import { ManualPostForm, SourceForm, TestFeedButton } from "../instagram/SourceForms";
import { OrganiserForm } from "./OrganiserForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.organisers.title };
}

/** Recurring events / organisers, and the public Instagram accounts watched for new events. */
export default async function OrganisersPage() {
  await requireAdmin();
  await ensureBuiltinData();
  const { t, f } = getI18n();
  const O = t.organisers;
  const S = t.instagram;
  const [organisers, sources, bridge] = await Promise.all([
    db.organiser.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { events: true } } } }),
    db.instagramSource.findMany({ orderBy: { username: "asc" }, include: { _count: { select: { posts: true } }, organiser: { select: { name: true } } } }),
    rssBridgeReachable(),
  ]);
  const providers = Object.keys(PROVIDERS).filter((p) => p !== "mock" || process.env.NODE_ENV !== "production");
  const organiserOptions = organisers.map((o) => ({ id: o.id, name: o.name }));

  return (
    <>
      <BackLink href="/admin/events">{t.events.queueTitle}</BackLink>
      <h1 className="page-title mb-1">{O.title}</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{O.intro}</p>

      <section id="instagram" aria-labelledby="instagram-title" className="mb-10 scroll-mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="instagram-title" className="section-title">
            {S.title}
          </h2>
          {sources.length ? (
            <form action={checkAllSources}>
              <SubmitButton className="btn-secondary min-h-9" pendingText={S.checking}>
                {S.checkAll}
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <p className="hint mb-2">{S.intro}</p>
        <p
          data-testid="bridge-status"
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            bridge.ok
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {bridge.ok ? S.bridgeOk(bridge.base ?? "") : S.bridgeDown(bridge.base ?? "—", bridge.error ?? "")}{" "}
          {monitorEnabled() ? S.schedule(pollIntervalMinutes()) : S.monitorOff}
        </p>

        {sources.length === 0 ? (
          <p className="card mb-4 text-sm text-zinc-500">{S.none}</p>
        ) : (
          <ul className="mb-4 space-y-2" data-testid="instagram-sources">
            {sources.map((s) => {
              const status = !s.lastCheckedAt ? "never" : s.lastError ? "error" : "healthy";
              const feedUrl = s.feedUrl || getProvider(s.providerName).buildFeedUrl(s.username);
              return (
                <li key={s.id} className="card space-y-1 p-3" data-testid="instagram-source">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://www.instagram.com/${s.username}/`} target="_blank" rel="noopener noreferrer" className="font-semibold">
                      @{s.username}
                    </a>
                    {s.displayName ? <span className="text-sm text-zinc-500">{s.displayName}</span> : null}
                    <span
                      data-testid="source-status"
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        status === "healthy"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : status === "error"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {(S.status as Record<string, string>)[status]}
                    </span>
                    {s.active ? null : <span className="rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800">{O.paused}</span>}
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-zinc-600 dark:text-zinc-300">
                    <dt className="font-medium">{S.provider}</dt>
                    <dd>{(S.providers as Record<string, string>)[s.providerName] ?? s.providerName}{s.organiser ? ` · ${s.organiser.name}` : ""}</dd>
                    <dt className="font-medium">{S.feedUrl}</dt>
                    <dd className="break-all">{feedUrl ?? S.noFeedUrl}</dd>
                    <dt className="font-medium">{S.lastSuccess}</dt>
                    <dd>{s.lastSuccessfulCheckAt ? f.dateTime(s.lastSuccessfulCheckAt) : "—"}</dd>
                    <dt className="font-medium">{S.latestPost}</dt>
                    <dd className="break-all">{s.latestSeenPostId ?? "—"}</dd>
                    <dt className="font-medium">{S.postsDetected}</dt>
                    <dd>{s._count.posts}</dd>
                  </dl>
                  {s.lastError ? (
                    <p className="text-xs text-red-700 dark:text-red-400" data-testid="source-error">
                      {S.lastError(s.lastError)}
                      {s.nextCheckAt ? ` ${S.nextTry(f.dateTime(s.nextCheckAt))}` : ""}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-start gap-2 pt-1">
                    <form action={checkSourceNow.bind(null, s.id)}>
                      <SubmitButton className="btn-secondary min-h-9" pendingText={S.checking}>
                        {S.checkNow}
                      </SubmitButton>
                    </form>
                    <TestFeedButton action={testSourceFeed.bind(null, s.id)} />
                    <Link href={`/admin/organisers/sources/${s.id}`} className="btn-ghost min-h-9">
                      {t.common.edit}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <details className="card mb-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{S.addSource}</summary>
          <div className="pt-3">
            <SourceForm action={saveSource.bind(null, null)} organisers={organiserOptions} providers={providers} submitLabel={S.addSource} />
          </div>
        </details>
        <details className="card">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{S.addManualPost}</summary>
          <div className="space-y-2 pt-3">
            <p className="hint">{S.manualHint}</p>
            <ManualPostForm action={addManualPostAction} sources={sources.map((s) => ({ id: s.id, username: s.username }))} />
          </div>
        </details>
      </section>

      <section aria-labelledby="organisers-title">
        <h2 id="organisers-title" className="section-title mb-2">
          {O.listTitle}
        </h2>
        <ul className="mb-6 space-y-2" data-testid="organisers">
          {organisers.map((o) => (
            <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.name}</span>
                  {o.active ? null : <span className="rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800">{O.paused}</span>}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{[o.city, o.usualVenue].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <Link href={`/admin/organisers/${o.id}`} className="btn-secondary min-h-9">
                {t.common.edit}
              </Link>
            </li>
          ))}
        </ul>
        <details className="card">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{O.add}</summary>
          <div className="pt-3">
            <OrganiserForm action={saveOrganiser.bind(null, null)} submitLabel={O.add} />
          </div>
        </details>
      </section>
    </>
  );
}
