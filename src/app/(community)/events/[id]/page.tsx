import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/FormBits";
import { LinkIcon, PinIcon } from "@/components/Icons";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPublicEvent } from "@/lib/events";
import { hostname } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { linkEventProject, setGoing } from "./actions";

async function load(id: string) {
  return idSchema.safeParse(id).success ? getPublicEvent(id) : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await load(params.id);
  return { title: event ? event.name : getI18n().t.events.title };
}

/** A shareable page for one approved event. */
export default async function EventPage({ params }: { params: { id: string } }) {
  const e = await load(params.id);
  if (!e) notFound();
  const { t, f } = getI18n();
  const E = t.events;
  const user = await getCurrentUser();
  const canAttend = !!user && !user.isGuest;
  const [attendance, projects] = await Promise.all([
    canAttend ? db.eventAttendance.findUnique({ where: { userId_eventId: { userId: user.id, eventId: e.id } } }) : null,
    canAttend ? db.project.findMany({ where: { ownerId: user.id, deletedAt: null, archivedAt: null }, orderBy: { characterName: "asc" }, select: { id: true, characterName: true } }) : [],
  ]);
  const dates = e.end.getTime() === e.start.getTime() ? f.date(e.start) : `${f.date(e.start)} – ${f.date(e.end)}`;
  return (
    <>
      <BackLink href="/events">{E.title}</BackLink>
      <header className="mb-4">
        <h1 className={`page-title break-words ${e.announceStatus === "cancelled" ? "line-through" : ""}`}>{e.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {(E.types as Record<string, string>)[e.eventType] ?? e.eventType}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              e.announceStatus === "cancelled" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
            }`}
            data-testid="announce-status"
          >
            {(E.statuses as Record<string, string>)[e.announceStatus] ?? e.announceStatus}
          </span>
        </div>
      </header>
      <section className="card space-y-2" data-testid="event-detail">
        <p className="font-semibold tabular-nums">
          {dates}
          {e.time ? ` · ${e.time}` : ""}
        </p>
        <p className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-300">
          <PinIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{[e.venue, e.address, e.city, e.country].filter(Boolean).join(" · ")}</span>
        </p>
        {e.tickets ? <p className="text-sm">{E.ticketsLine(e.tickets)}</p> : null}
        {e.notes ? <p className="whitespace-pre-wrap break-words text-sm">{e.notes}</p> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {e.mapLink ? (
            <a href={e.mapLink} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-9 gap-1.5 px-3 text-sm" data-testid="map-link">
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
          {e.sourceUrl && e.sourceUrl !== e.url ? (
            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1 text-sm">
              <LinkIcon className="h-3.5 w-3.5" />
              {E.source}
            </a>
          ) : null}
          {user?.isAdmin ? (
            <Link href={`/admin/events/${e.id}`} className="link inline-flex min-h-9 items-center px-1 text-sm">
              {t.common.edit}
            </Link>
          ) : null}
        </div>
      </section>
      {canAttend ? (
        <section className="card mt-4 space-y-3" aria-label={E.going} data-testid="attendance">
          <form action={setGoing.bind(null, e.id, !attendance)}>
            <SubmitButton className={attendance ? "btn-primary" : "btn-secondary"} pendingText="…" aria-pressed={!!attendance}>
              {attendance ? E.goingYes : E.going}
            </SubmitButton>
          </form>
          <p className="hint">{E.goingHint}</p>
          {attendance && projects.length ? (
            <form action={linkEventProject.bind(null, e.id)} className="flex flex-wrap items-end gap-2">
              <Field
                as="select"
                className="min-w-0 flex-1 basis-56"
                label={E.goingProject}
                name="projectId"
                defaultValue={attendance.projectId ?? ""}
                options={[{ value: "", label: E.goingNoProject }, ...projects.map((p) => ({ value: p.id, label: p.characterName }))]}
              />
              <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
