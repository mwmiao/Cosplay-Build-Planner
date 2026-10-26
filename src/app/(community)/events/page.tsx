import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon, PinIcon, PlusIcon } from "@/components/Icons";
import { EmptyState } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { type EventView, listEvents, today } from "@/lib/events";
import { hostname } from "@/lib/format";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.title };
}

export default async function EventsPage({ searchParams }: { searchParams: { when?: string; city?: string } }) {
  const [user, all] = await Promise.all([getCurrentUser(), listEvents()]);
  const { t, f } = getI18n();
  const E = t.events;
  const past = searchParams.when === "past";
  const now = today().getTime();
  const inWindow = all.filter((e) => (past ? e.end.getTime() < now : e.end.getTime() >= now));
  const cities = [...new Set(inWindow.map((e) => e.city))].sort((a, b) => a.localeCompare(b, t.intl));
  const city = cities.includes(searchParams.city ?? "") ? searchParams.city : undefined;
  const events = inWindow.filter((e) => !city || e.city === city);
  if (past) events.reverse();

  // Upcoming: one heading per month. Past: one per year.
  const heading = (e: EventView) =>
    past
      ? String(e.start.getUTCFullYear())
      : e.start.toLocaleDateString(t.intl, { timeZone: "UTC", month: "long", year: "numeric" });
  const groups: { title: string; items: EventView[] }[] = [];
  for (const e of events) {
    const title = heading(e);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(e);
    else groups.push({ title, items: [e] });
  }

  const href = (change: { when?: "past" | null; city?: string | null }) => {
    const qs = new URLSearchParams();
    const when = change.when === undefined ? (past ? "past" : null) : change.when;
    const c = change.city === undefined ? city : change.city;
    if (when) qs.set("when", when);
    if (c) qs.set("city", c);
    const s = qs.toString();
    return `/events${s ? `?${s}` : ""}`;
  };

  const range = (e: EventView) =>
    e.end.getTime() === e.start.getTime() ? f.date(e.start) : `${f.date(e.start)} – ${f.date(e.end)}`;
  const when = (e: EventView) => {
    const start = Math.round((e.start.getTime() - now) / 86_400_000);
    if (e.start.getTime() <= now && e.end.getTime() >= now) return { text: E.happeningNow, hot: true };
    if (start > 0) return { text: E.inDays(start), hot: start <= 14 };
    return null;
  };

  return (
    <>
      <header className="mb-1 flex items-center justify-between gap-3">
        <h1 className="page-title">{E.title}</h1>
        {user?.isAdmin ? (
          <Link href="/admin/events/new" className="btn-primary">
            <PlusIcon className="h-5 w-5" /> {E.add}
          </Link>
        ) : null}
      </header>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{E.intro}</p>

      <div className="mb-3 flex gap-2" role="group" aria-label={E.show}>
        <Link href={href({ when: null, city: null })} className={past ? "chip-off" : "chip-on"} aria-current={!past ? "page" : undefined}>
          {E.upcoming}
        </Link>
        <Link href={href({ when: "past", city: null })} className={past ? "chip-on" : "chip-off"} aria-current={past ? "page" : undefined}>
          {E.past}
        </Link>
      </div>
      {cities.length > 1 ? (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={E.filterCity}>
          <Link href={href({ city: null })} className={!city ? "chip-on" : "chip-off"}>
            {E.allCities}
          </Link>
          {cities.map((c) => (
            <Link key={c} href={href({ city: c })} className={city === c ? "chip-on" : "chip-off"}>
              {c}
            </Link>
          ))}
        </div>
      ) : null}

      {events.length === 0 ? (
        <EmptyState title={past ? E.noPast : E.noUpcoming}>{E.emptyText}</EmptyState>
      ) : (
        <div className="space-y-6" data-testid="events-list">
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h2 className="section-title mb-2 capitalize">{g.title}</h2>
              <ul className="space-y-2">
                {g.items.map((e) => {
                  const badge = past ? null : when(e);
                  return (
                    <li key={e.id} className="card flex gap-3 p-3" data-testid="event">
                      <div
                        className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2 text-center ${
                          past ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                        }`}
                        aria-hidden="true"
                      >
                        <span className="text-xl font-bold leading-none tabular-nums">{e.start.getUTCDate()}</span>
                        <span className="mt-1 text-[11px] font-semibold uppercase">
                          {e.start.toLocaleDateString(t.intl, { timeZone: "UTC", month: "short" }).replace(".", "")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{e.name}</h3>
                          {badge ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                badge.hot ? "bg-accent-100 text-accent-700 dark:bg-accent-700/30 dark:text-accent-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {badge.text}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{range(e)}</p>
                        <p className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                          <PinIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{[e.venue, e.city].filter(Boolean).join(" · ")}</span>
                        </p>
                        {e.dateUnconfirmed ? <p className="hint">{E.dateUnconfirmed}</p> : null}
                        {e.notes ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.notes}</p> : null}
                        <div className="mt-1 flex flex-wrap gap-x-4">
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-sm">
                              <LinkIcon className="h-3.5 w-3.5" />
                              {hostname(e.url) ?? E.website}
                            </a>
                          ) : null}
                          {user?.isAdmin && !e.builtin ? (
                            <Link href={`/admin/events/${e.id}`} className="link text-sm">
                              {t.common.edit}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="hint mt-8">{user?.isAdmin ? E.footerAdmin : E.footer}</p>
    </>
  );
}
