import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { ThemePicker } from "@/components/ThemePicker";
import { db } from "@/lib/db";
import { authEnabled } from "@/lib/env";
import { formatDate, rateLabel } from "@/lib/format";
import { getMoneyContext } from "@/lib/queries";
import { crossRate } from "@/lib/rates";
import { DefaultCurrencyForm, RefreshRatesButton } from "./CurrencySettings";
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
  const ctx = await getMoneyContext();
  const base = ctx.defaultCurrency;
  // Currencies actually used anywhere, to show their current rates.
  const used = new Set<string>();
  for (const rows of await Promise.all([
    db.project.findMany({ where: { deletedAt: null, currency: { not: null } }, select: { currency: true }, distinct: ["currency"] }),
    db.buildPart.findMany({ where: { deletedAt: null, currency: { not: null } }, select: { currency: true }, distinct: ["currency"] }),
    db.shoppingListItem.findMany({ where: { deletedAt: null, currency: { not: null } }, select: { currency: true }, distinct: ["currency"] }),
  ])) {
    for (const r of rows) if (r.currency && r.currency !== base) used.add(r.currency);
  }
  // Baked into the Docker image by CI; "dev" when running from source.
  const version = process.env.APP_VERSION ?? "dev";
  const isSha = /^[0-9a-f]{40}$/.test(version);
  const builtAt = process.env.BUILD_DATE ? new Date(process.env.BUILD_DATE) : null;

  return (
    <>
      <h1 className="page-title mb-4">Settings</h1>

      <section className="card mb-6 space-y-4">
        <ThemePicker />
      </section>

      <section className="card mb-6 space-y-4" aria-labelledby="currency-title">
        <h2 id="currency-title" className="section-title">
          Currency
        </h2>
        <DefaultCurrencyForm current={base} />
        <div className="border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <h3 className="mb-1 font-semibold">Exchange rates</h3>
          <p className="hint mb-3">
            Today&apos;s rates estimate planned costs and refresh every 6 hours. Payments are converted once, at the rate for
            their payment date (European Central Bank), and never change afterwards.
          </p>
          {ctx.rates.fetchedAt ? (
            <dl className="mb-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500 dark:text-zinc-400">Source</dt>
              <dd>{ctx.rates.source}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Rates for</dt>
              <dd>{ctx.rates.rateDate}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Checked</dt>
              <dd>{ctx.rates.fetchedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
              {[...used].sort().map((c) => (
                <div key={c} className="contents">
                  <dt className="text-zinc-500 dark:text-zinc-400">{c}</dt>
                  <dd className="tabular-nums">{rateLabel(crossRate(ctx.rates, c, base), c, base)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mb-3 text-amber-700 dark:text-amber-400">
              No rates downloaded yet. The app needs internet access once to get them.
            </p>
          )}
          <RefreshRatesButton />
          <p className="hint mt-3">
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="link">
              Rates By Exchange Rate API
            </a>{" "}
            · ECB reference rates via{" "}
            <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer" className="link">
              Frankfurter
            </a>
          </p>
        </div>
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
          <dt className="text-zinc-500 dark:text-zinc-400">Version</dt>
          <dd>
            {isSha ? (
              <a
                href={`https://github.com/mwmiao/Cosplay-Build-Planner/commit/${version}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link font-mono"
              >
                {version.slice(0, 7)}
              </a>
            ) : (
              <span className="font-mono">{version}</span>
            )}
          </dd>
          {builtAt && !Number.isNaN(builtAt.getTime()) ? (
            <>
              <dt className="text-zinc-500 dark:text-zinc-400">Built</dt>
              <dd>
                {builtAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </dd>
            </>
          ) : null}
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

      {authEnabled() ? (
        <form action={logout}>
          <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText="Logging out…">
            Log out
          </SubmitButton>
        </form>
      ) : (
        <p className="hint">Login is off (no APP_PASSWORD set). Anyone who can reach this address can use the app.</p>
      )}
    </>
  );
}
