import type { Metadata } from "next";
import { ConfirmButton, SubmitButton } from "@/components/FormBits";
import { ThemePicker } from "@/components/ThemePicker";
import pkg from "../../../../package.json";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getMoneyContext } from "@/lib/queries";
import { crossRate } from "@/lib/rates";
import { DefaultCurrencyForm, LanguagePicker, RefreshRatesButton } from "./CurrencySettings";
import Link from "next/link";
import { signOut } from "../../(auth)/actions";
import { purgeProject, restoreProject } from "../projects/actions";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.settings.title };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const { t, f } = getI18n();
  const S = t.settings;
  const [deleted, counts] = await Promise.all([
    db.project.findMany({
      where: { ownerId: user.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, characterName: true, series: true, deletedAt: true },
    }),
    Promise.all([
      db.project.count({ where: { ownerId: user.id, deletedAt: null } }),
      db.buildPart.count({ where: { deletedAt: null, project: { ownerId: user.id, deletedAt: null } } }),
      db.referenceImage.count({ where: { project: { ownerId: user.id, deletedAt: null } } }),
    ]),
  ]);
  const [projectCount, partCount, imageCount] = counts;
  const ctx = await getMoneyContext(user.id);
  const base = ctx.defaultCurrency;
  // Currencies actually used anywhere, to show their current rates.
  const used = new Set<string>();
  for (const rows of await Promise.all([
    db.project.findMany({ where: { ownerId: user.id, deletedAt: null, currency: { not: null } }, select: { currency: true }, distinct: ["currency"] }),
    db.buildPart.findMany({ where: { deletedAt: null, currency: { not: null }, project: { ownerId: user.id } }, select: { currency: true }, distinct: ["currency"] }),
    db.shoppingListItem.findMany({ where: { deletedAt: null, currency: { not: null }, ownerId: user.id }, select: { currency: true }, distinct: ["currency"] }),
  ])) {
    for (const r of rows) if (r.currency && r.currency !== base) used.add(r.currency);
  }
  // Baked into the Docker image by CI; package.json's version when running from source.
  const version = process.env.APP_VERSION ?? pkg.version;
  const commit = /^[0-9a-f]{40}$/.test(process.env.APP_COMMIT ?? "") ? process.env.APP_COMMIT : null;
  const builtAt = process.env.BUILD_DATE ? new Date(process.env.BUILD_DATE) : null;

  return (
    <>
      <h1 className="page-title mb-4">{S.title}</h1>

      <section className="card mb-6 space-y-6">
        <LanguagePicker />
        <ThemePicker />
      </section>

      <section className="card mb-6 space-y-4" aria-labelledby="currency-title">
        <h2 id="currency-title" className="section-title">
          {S.currency}
        </h2>
        <DefaultCurrencyForm current={base} />
        <div className="border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <h3 className="mb-1 font-semibold">{S.rates}</h3>
          <p className="hint mb-3">{S.ratesHint}</p>
          {ctx.rates.fetchedAt ? (
            <dl className="mb-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500 dark:text-zinc-400">{S.source}</dt>
              <dd>{ctx.rates.source}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{S.ratesFor}</dt>
              <dd>{ctx.rates.rateDate}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{S.checked}</dt>
              <dd>{f.dateTime(ctx.rates.fetchedAt)}</dd>
              {[...used].sort().map((c) => (
                <div key={c} className="contents">
                  <dt className="text-zinc-500 dark:text-zinc-400">{c}</dt>
                  <dd className="tabular-nums">{f.rate(crossRate(ctx.rates, c, base), c, base)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mb-3 text-amber-700 dark:text-amber-400">{S.noRates}</p>
          )}
          <RefreshRatesButton />
          <p className="hint mt-3">
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="link">
              {S.ratesCredit}
            </a>{" "}
            · {S.ecbVia}{" "}
            <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer" className="link">
              Frankfurter
            </a>
          </p>
        </div>
      </section>

      <section className="card mb-6" aria-labelledby="deleted-title">
        <h2 id="deleted-title" className="section-title mb-1">
          {S.deleted}
        </h2>
        <p className="hint mb-3">{S.deletedHint}</p>
        {deleted.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{S.nothing}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {deleted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.characterName}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {p.series ? `${p.series} · ` : ""}{S.deletedOn(f.date(p.deletedAt))}
                  </div>
                </div>
                <form action={restoreProject.bind(null, p.id)}>
                  <SubmitButton className="btn-secondary" pendingText="…">
                    {S.restore}
                  </SubmitButton>
                </form>
                <form action={purgeProject.bind(null, p.id)}>
                  <ConfirmButton message={S.purgeConfirm(p.characterName)}>
                    {S.deleteForever}
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mb-6 text-sm" aria-labelledby="about-title">
        <h2 id="about-title" className="section-title mb-2">
          {S.about}
        </h2>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-zinc-500 dark:text-zinc-400">{S.version}</dt>
          <dd>
            <a
              href="https://github.com/mwmiao/Cosplay-Build-Planner/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="link font-mono"
            >
              {version}
            </a>
            {commit ? (
              <>
                {" · "}
                <a
                  href={`https://github.com/mwmiao/Cosplay-Build-Planner/commit/${commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link font-mono"
                >
                  {commit.slice(0, 7)}
                </a>
              </>
            ) : null}
          </dd>
          {builtAt && !Number.isNaN(builtAt.getTime()) ? (
            <>
              <dt className="text-zinc-500 dark:text-zinc-400">{S.built}</dt>
              <dd>{f.dateTime(builtAt)}</dd>
            </>
          ) : null}
          <dt className="text-zinc-500 dark:text-zinc-400">{S.projects}</dt>
          <dd className="tabular-nums">{projectCount}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">{S.parts}</dt>
          <dd className="tabular-nums">{partCount}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">{S.images}</dt>
          <dd className="tabular-nums">{imageCount}</dd>
        </dl>
        <p className="hint mt-3">{S.dataHint}</p>
      </section>

      <section className="card mb-6 flex flex-wrap items-center justify-between gap-3" aria-label={t.auth.account}>
        <div className="min-w-0 text-sm">
          <div className="font-semibold">{t.auth.signedInAs(user.name)}</div>
          <div className="truncate text-zinc-500 dark:text-zinc-400">{user.email}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/account" className="btn-secondary">
            {t.auth.account}
          </Link>
          <form action={signOut}>
            <SubmitButton className="btn-ghost" pendingText={t.auth.loggingOut}>
              {t.auth.logout}
            </SubmitButton>
          </form>
        </div>
      </section>
    </>
  );
}
