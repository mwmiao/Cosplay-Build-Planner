import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/FormBits";
import { CheckIcon, DownloadIcon, LinkIcon } from "@/components/Icons";
import { EmptyState } from "@/components/ui";
import { categoryLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { activeProjectWhere } from "@/lib/projects";
import { type GroupBy, groupItems, itemTotal, loadShoppingItems, parseGroup } from "@/lib/shoppingList";
import { clearPurchased, deleteShoppingItem, togglePurchased } from "./actions";
import { AddItemForm } from "./AddItemForm";

export const metadata: Metadata = { title: "Shopping list" };

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "supplier", label: "Supplier" },
  { value: "category", label: "Category" },
  { value: "project", label: "Project" },
];

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: { group?: string; show?: string };
}) {
  const group = parseGroup(searchParams.group);
  const showPurchased = searchParams.show === "all";
  const [items, projects] = await Promise.all([
    loadShoppingItems(showPurchased),
    db.project.findMany({
      where: activeProjectWhere,
      select: { id: true, characterName: true },
      orderBy: { characterName: "asc" },
    }),
  ]);
  const groups = groupItems(items, group);
  const open = items.filter((i) => !i.purchased);
  const openTotal = open.reduce((sum, i) => sum + itemTotal(i), 0);
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
          <h1 className="page-title">Shopping list</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {open.length} item{open.length === 1 ? "" : "s"} to buy · est. {money(openTotal)}
          </p>
        </div>
        <a href={exportHref} className="btn-secondary shrink-0" download>
          <DownloadIcon className="h-5 w-5" /> CSV
        </a>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400" id="group-label">
          Group by
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="group-label">
          {GROUPS.map((g) => (
            <Link key={g.value} href={href({ group: g.value })} className={group === g.value ? "chip-on" : "chip-off"}>
              {g.label}
            </Link>
          ))}
        </div>
        <Link href={href({ show: showPurchased ? undefined : "all" })} className={`${showPurchased ? "chip-on" : "chip-off"} sm:ml-auto`}>
          {showPurchased ? "Hide purchased" : "Show purchased"}
        </Link>
      </div>

      <details className="card mb-6">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">+ Add an item</summary>
        <div className="pt-3">
          <AddItemForm projects={projects} />
        </div>
      </details>

      {items.length === 0 ? (
        <EmptyState title={showPurchased ? "Nothing on the list" : "Nothing left to buy"}>
          Parts marked <strong>Needed</strong> in active projects appear here automatically. You can also add items by hand.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map(([name, list]) => (
            <section key={name} aria-label={name}>
              <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span>{name}</span>
                <span className="tabular-nums normal-case">
                  {money(list.filter((i) => !i.purchased).reduce((s, i) => s + itemTotal(i), 0))}
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
                        aria-label={`${item.name}: purchased`}
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
                          <span>General</span>
                        )}
                        {group !== "category" ? <span>{categoryLabel(item.category)}</span> : null}
                        {group !== "supplier" && item.supplier ? <span>{item.supplier}</span> : null}
                        {item.estimatedCostCents !== null ? <span className="tabular-nums">est {money(itemTotal(item))}</span> : null}
                      </div>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost h-11 w-11 shrink-0 px-0"
                        aria-label={`Open shop link for ${item.name}`}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </a>
                    ) : null}
                    {!item.partId ? (
                      <form action={deleteShoppingItem.bind(null, item.id)}>
                        <ConfirmButton
                          message={`Remove “${item.name}” from the list?`}
                          className="btn-ghost h-11 w-11 shrink-0 px-0 text-zinc-400"
                          aria-label={`Remove ${item.name}`}
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

      {purchasedManual ? (
        <form action={clearPurchased} className="mt-6">
          <ConfirmButton className="btn-secondary" message="Remove all ticked-off items you added by hand?">
            Clear purchased items
          </ConfirmButton>
        </form>
      ) : null}
    </>
  );
}
