import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/FormBits";
import { CheckIcon, DownloadIcon, LinkIcon } from "@/components/Icons";
import { EmptyState } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { activeProjectsOf } from "@/lib/projects";
import { getMoneyContext } from "@/lib/queries";
import {
  type GroupBy,
  convertedTotal,
  groupItems,
  itemCurrency,
  itemTotal,
  loadShoppingItems,
  parseGroup,
} from "@/lib/shoppingList";
import { clearPurchased, deleteShoppingItem, togglePurchased } from "./actions";
import { AddItemForm } from "./AddItemForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.shopping.title };
}

const GROUPS: GroupBy[] = ["supplier", "category", "project"];

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: { group?: string; show?: string };
}) {
  const user = await requireUser();
  const { t, f } = getI18n();
  const S = t.shopping;
  const group = parseGroup(searchParams.group);
  const showPurchased = searchParams.show === "all";
  const [items, projects, ctx] = await Promise.all([
    loadShoppingItems(user.id, showPurchased),
    db.project.findMany({
      where: activeProjectsOf(user.id),
      select: { id: true, characterName: true },
      orderBy: { characterName: "asc" },
    }),
    getMoneyContext(user.id),
  ]);
  const cur = ctx.defaultCurrency;
  const groups = groupItems(items, group, t);
  const open = items.filter((i) => !i.purchased);
  const openTotal = convertedTotal(open, ctx);
  const purchasedManual = items.some((i) => i.purchased && !i.partId);

  const href = (change: { group?: GroupBy; show?: string | undefined }) => {
    const qs = new URLSearchParams();
    const g = change.group ?? group;
    if (g !== "supplier") qs.set("group", g);
    const s = "show" in change ? change.show : showPurchased ? "all" : undefined;
    if (s) qs.set("show", s);
    const q = qs.toString();
    return `/shopping${q ? `?${q}` : ""}`;
  };
  const exportHref = `/api/export/shopping?group=${group}${showPurchased ? "&show=all" : ""}`;

  return (
    <>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{S.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {S.toBuy(open.length)} · {S.est} {openTotal.converted ? "≈ " : ""}
            {f.money(openTotal.total, cur)}
          </p>
        </div>
        <a href={exportHref} className="btn-secondary shrink-0" download>
          <DownloadIcon className="h-5 w-5" /> {t.common.csv}
        </a>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400" id="group-label">
          {S.groupBy}
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="group-label">
          {GROUPS.map((g) => (
            <Link key={g} href={href({ group: g })} className={group === g ? "chip-on" : "chip-off"}>
              {S.group[g]}
            </Link>
          ))}
        </div>
        <Link href={href({ show: showPurchased ? undefined : "all" })} className={`${showPurchased ? "chip-on" : "chip-off"} sm:ml-auto`}>
          {showPurchased ? S.hidePurchased : S.showPurchased}
        </Link>
      </div>

      <details className="card mb-6">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{S.addItem}</summary>
        <div className="pt-3">
          <AddItemForm projects={projects} defaultCurrency={cur} />
        </div>
      </details>

      {items.length === 0 ? (
        <EmptyState title={showPurchased ? S.emptyAll : S.emptyOpen}>{S.emptyText}</EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map(([name, list]) => (
            <section key={name} aria-label={name}>
              <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span>{name}</span>
                <span className="tabular-nums normal-case">
                  {(() => {
                    const sum = convertedTotal(
                      list.filter((i) => !i.purchased),
                      ctx,
                    );
                    return `${sum.converted ? "≈ " : ""}${f.money(sum.total, cur)}`;
                  })()}
                </span>
              </h2>
              <ul className="space-y-2">
                {list.map((item) => (
                  <li key={item.id} className="card flex items-center gap-3 p-3" data-testid="shopping-item">
                    <form action={togglePurchased.bind(null, item.id)}>
                      <button
                        type="submit"
                        role="checkbox"
                        aria-checked={item.purchased}
                        aria-label={S.purchased(item.name)}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
                          item.purchased
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-zinc-300 text-transparent hover:border-green-600 hover:text-green-600 dark:border-zinc-600"
                        }`}
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium ${item.purchased ? "text-zinc-400 line-through dark:text-zinc-500" : ""}`}>
                        {item.name}
                        {item.quantity > 1 ? <span className="text-zinc-500"> ×{item.quantity}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.project ? (
                          <Link href={`/projects/${item.project.id}#parts`} className="hover:underline">
                            {item.project.characterName}
                          </Link>
                        ) : (
                          <span>{t.common.general}</span>
                        )}
                        {group !== "category" ? <span>{categoryLabel(item.category, t)}</span> : null}
                        {group !== "supplier" && item.supplier ? <span>{item.supplier}</span> : null}
                        {item.estimatedCostCents !== null ? (
                          <span className="tabular-nums">{t.project.estimate(f.money(itemTotal(item), itemCurrency(item, ctx)))}</span>
                        ) : null}
                      </div>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost h-11 w-11 shrink-0 px-0"
                        aria-label={S.openShopLink(item.name)}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </a>
                    ) : null}
                    {!item.partId ? (
                      <form action={deleteShoppingItem.bind(null, item.id)}>
                        <ConfirmButton
                          message={S.removeConfirm(item.name)}
                          className="btn-ghost h-11 w-11 shrink-0 px-0 text-zinc-400"
                          aria-label={S.remove(item.name)}
                        >
                          ✕
                        </ConfirmButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {openTotal.converted || openTotal.missing.length ? (
        <p className="hint mt-4">
          {S.totalsNote(cur, ctx.rates.rateDate)}
          {openTotal.missing.length ? S.missingNote(openTotal.missing.join(", ")) : ""}
        </p>
      ) : null}

      {purchasedManual ? (
        <form action={clearPurchased} className="mt-6">
          <ConfirmButton className="btn-secondary" message={S.clearConfirm}>
            {S.clearPurchased}
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
