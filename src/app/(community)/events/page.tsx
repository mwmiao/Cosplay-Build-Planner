import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon, PinIcon, PlusIcon } from "@/components/Icons";
import { EmptyState } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { adminCounts } from "@/lib/adminCounts";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { type EventView, listEvents, mapsLink, today } from "@/lib/events";
import { hostname } from "@/lib/format";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.title };
}

export default async function EventsPage({ searchParams }: { searchParams: { when?: string; city?: string; type?: string; month?: string; suggested?: string } }) {
  const [user, all] = await Promise.all([getCurrentUser(), listEvents()]);
  const pendingCount = user?.isAdmin ? (await adminCounts(user)).toReview : 0;
  const going = new Set(
    user && !user.isGuest ? (await db.eventAttendance.findMany({ where: { userId: user.id }, select: { eventId: true } })).map((a) => a.eventId) : [],
  );
  const { t, f } = getI18n();
  const E = t.events;
  const past = searchParams.when === "past";
  const now = today().getTime();
  const inWindow = all.filter((e) => (past ? e.end.getTime() < now : e.end.getTime() >= now));
  // Recurring organisers with no upcoming date yet (not guessed: shown as "not announced").
  const upcomingOrganisers = new Set(all.filter((e) => e.end.getTime() >= now && e.organiserId).map((e) => e.organiserId));
  const awaiting = (await db.organiser.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    // Accounts managed under Admin › Organisers (Organiser.instagram is the pre-1.7.1 copy).
    include: { sources: { select: { username: true }, orderBy: { username: "asc" } } },
  })).filter(
    (o) => !upcomingOrganisers.has(o.id) && (!searchParams.city || o.city === searchParams.city),
  );
  const cities = [...new Set(inWindow.map((e) => e.city))].sort((a, b) => a.localeCompare(b, t.intl));
  const city = cities.includes(searchParams.city ?? "") ? searchParams.city : undefined;
  const inCity = inWindow.filter((e) => !city || e.city === city);
  const types = [...new Set(inCity.map((e) => e.eventType))];
  const type = types.includes(searchParams.type ?? "") ? searchParams.type : undefined;
  const monthOf = (e: EventView) => e.start.toISOString().slice(0, 7);
  const months = past ? [] : [...new Set(inCity.map(monthOf))];
  const month = months.includes(searchParams.month ?? "") ? searchParams.month : undefined;
  const events = inCity.filter((e) => (!type || e.eventType === type) && (!month || monthOf(e) === month));
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

  const href = (change: { when?: "past" | null; city?: string | null; type?: string | null; month?: string | null }) => {
    const qs = new URLSearchParams();
    const when = change.when === undefined ? (past ? "past" : null) : change.when;
    const c = change.city === undefined ? city : change.city;
    if (when) qs.set("when", when);
    if (c) qs.set("city", c);
    const ty = change.type === undefined ? type : change.type;
    if (ty) qs.set("type", ty);
    const mo = change.month === undefined ? month : change.month;
    if (mo) qs.set("month", mo);
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
        ) : user && !user.isGuest ? (
          <Link href="/events/suggest" className="btn-secondary">
            <PlusIcon className="h-5 w-5" /> {E.suggest}
          </Link>
        ) : null}
      </header>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">{E.intro}</p>
      {searchParams.suggested ? (
        <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {E.suggestedThanks}
        </div>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          href="/admin/events"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"
        >
          {E.pendingBanner(pendingCount)} <span aria-hidden="true">→</span>
        </Link>
      ) : user?.isAdmin ? (
        <p className="mb-4 text-sm">
          <Link href="/admin/events" className="link">
            {E.queueTitle}
          </Link>
        </p>
      ) : null}

      <div className="mb-3 flex gap-2" role="group" aria-label={E.show}>
        <Link href={href({ when: null, city: null, type: null, month: null })} className={past ? "chip-off" : "chip-on"} aria-current={!past ? "page" : undefined}>
          {E.upcoming}
        </Link>
        <Link href={href({ when: "past", city: null, type: null, month: null })} className={past ? "chip-on" : "chip-off"} aria-current={past ? "page" : undefined}>
          {E.past}
        </Link>
      </div>
      {cities.length > 1 ? (
        <div className="chip-row mb-4" role="group" aria-label={E.filterCity}>
          <Link href={href({ city: null, month: null })} className={!city ? "chip-on" : "chip-off"}>
            {E.allCities}
          </Link>
          {cities.map((c) => (
            <Link key={c} href={href({ city: c, month: null })} className={city === c ? "chip-on" : "chip-off"}>
              {c}
            </Link>
          ))}
        </div>
      ) : null}
      {types.length > 1 ? (
        <div className="chip-row mb-4" role="group" aria-label={E.filterType}>
          <Link href={href({ type: null })} className={!type ? "chip-on" : "chip-off"}>
            {E.allTypes}
          </Link>
          {types.map((v) => (
            <Link key={v} href={href({ type: v })} className={type === v ? "chip-on" : "chip-off"}>
              {(E.types as Record<string, string>)[v] ?? v}
            </Link>
          ))}
        </div>
      ) : null}
      {months.length > 1 ? (
        <div className="chip-row mb-4" role="group" aria-label={E.filterMonth}>
          <Link href={href({ month: null })} className={!month ? "chip-on" : "chip-off"}>
            {E.allMonths}
          </Link>
          {months.map((m) => (
            <Link key={m} href={href({ month: m })} className={month === m ? "chip-on" : "chip-off"}>
              {new Date(`${m}-01T00:00:00.000Z`).toLocaleDateString(t.intl, { timeZone: "UTC", month: "short", year: "numeric" })}
            </Link>
          ))}
        </div>
      ) : null}

      {events.length === 0 ? (
        <EmptyState title={type || month ? E.noMatch : past ? E.noPast : E.noUpcoming}>{E.emptyText}</EmptyState>
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
                          past ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
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
                          <h3 className={`font-semibold ${e.announceStatus === "cancelled" ? "line-through" : ""}`}>
                            <Link href={`/events/${e.id}`} className="hover:underline">
                              {e.name}
                            </Link>
                          </h3>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {(E.types as Record<string, string>)[e.eventType] ?? e.eventType}
                          </span>
                          {e.announceStatus !== "announced" || !past ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                e.announceStatus === "cancelled"
                                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                  : e.announceStatus === "tickets"
                                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                    : e.announceStatus === "confirmed"
                                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                                      : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              }`}
                              data-testid="announce-status"
                            >
                              {(E.statuses as Record<string, string>)[e.announceStatus] ?? e.announceStatus}
                            </span>
                          ) : null}
                          {going.has(e.id) ? (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" data-testid="going-chip">
                              {E.goingYes}
                            </span>
                          ) : null}
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
                        <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
                          {range(e)}
                          {e.time ? ` · ${e.time}` : ""}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                          <PinIcon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 break-words">{[e.venue, e.address, e.city].filter(Boolean).join(" · ")}</span>
                        </p>
                        {e.tickets ? <p className="text-sm">{E.ticketsLine(e.tickets)}</p> : null}
                        {e.notes ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.notes}</p> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          {e.mapLink ? (
                            <a
                              href={e.mapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary min-h-9 gap-1.5 px-3 text-sm"
                              data-testid="map-link"
                              aria-label={E.openMapFor(e.venue ?? e.name)}
                            >
                              <PinIcon className="h-4 w-4" />
                              {E.openMap}
                            </a>
                          ) : null}
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-sm">
                              <LinkIcon className="h-3.5 w-3.5" />
                              {hostname(e.url) ?? E.website}
                            </a>
                          ) : null}
                          {user?.isAdmin ? (
                            <Link href={`/admin/events/${e.id}`} className="link inline-flex min-h-9 items-center px-1 text-sm">
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

      {!past && !type && !month && awaiting.length ? (
        <section className="mt-8" aria-labelledby="awaiting-title" data-testid="awaiting">
          <h2 id="awaiting-title" className="section-title mb-1">
            {E.awaitingTitle}
          </h2>
          <p className="hint mb-2">{E.awaitingHint}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {awaiting.map((o) => {
              const map = mapsLink({ venue: o.usualVenue, address: o.usualAddress, city: o.city ?? "" });
              return (
                <li key={o.id} className="card p-3">
                  <div className="font-semibold">{o.name}</div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {[(E.types as Record<string, string>)[o.eventType], o.usualVenue, o.city].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                    {o.sources.map((s) => (
                      <a key={s.username} href={`https://www.instagram.com/${s.username}/`} target="_blank" rel="noopener noreferrer" className="link">
                        @{s.username}
                      </a>
                    ))}
                    {o.website ? (
                      <a href={o.website} target="_blank" rel="noopener noreferrer" className="link">
                        {hostname(o.website) ?? E.website}
                      </a>
                    ) : null}
                    {map ? (
                      <a href={map} target="_blank" rel="noopener noreferrer" className="link">
                        {E.openMap}
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="hint mt-8">{user?.isAdmin ? E.footerAdmin : E.footer}</p>
    </>
  );
}
