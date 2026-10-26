"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import type { View } from "@/lib/viewPrefs";
import { GridIcon, ListIcon } from "./Icons";

/**
 * Sort menu + grid/list switch for a list page. Choices live in the URL (so
 * links and the back button work) and are remembered in a cookie per page,
 * which the server reads when the URL doesn't say.
 */
export function ViewControls({
  cookie,
  sort,
  view,
  options,
}: {
  /** Cookie name, e.g. "projects-view" */
  cookie: string;
  sort: string;
  view: View;
  options: { value: string; label: string }[];
}) {
  const { t } = useI18n();
  const V = t.views;
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    document.cookie = `${cookie}=${encodeURIComponent(`${sort}.${view}`)}; path=/; max-age=31536000; samesite=lax`;
  }, [cookie, sort, view]);

  const go = (change: { sort?: string; view?: View }) => {
    const qs = new URLSearchParams(params.toString());
    if (change.sort) qs.set("sort", change.sort);
    if (change.view) qs.set("layout", change.view);
    qs.delete("page");
    router.push(`?${qs.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`${cookie}-sort`}>
        {V.sortBy}
      </label>
      <select
        id={`${cookie}-sort`}
        value={sort}
        onChange={(e) => go({ sort: e.target.value })}
        className="input min-h-9 w-auto py-1 pr-8 text-sm"
        data-testid="sort-select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {V.sortPrefix} {o.label}
          </option>
        ))}
      </select>
      <div className="flex rounded-xl border border-zinc-300 p-0.5 dark:border-zinc-700" role="group" aria-label={V.layout}>
        {(["grid", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => go({ view: v })}
            aria-pressed={view === v}
            aria-label={v === "grid" ? V.grid : V.list}
            title={v === "grid" ? V.grid : V.list}
            className={`flex h-8 w-9 items-center justify-center rounded-lg ${
              view === v ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {v === "grid" ? <GridIcon className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}
