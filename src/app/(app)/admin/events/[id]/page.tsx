import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/FormBits";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { deleteEvent, updateEvent } from "../actions";
import { EventForm } from "../EventForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.edit };
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const id = idSchema.safeParse(params.id);
  if (!id.success) notFound();
  const event = await db.event.findUnique({ where: { id: id.data } });
  if (!event) notFound();
  const { t } = getI18n();
  const E = t.events;
  return (
    <>
      <BackLink href="/events">{E.title}</BackLink>
      <h1 className="page-title mb-4">{E.edit}</h1>
      {event.status === "needs_review" ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {E.pendingEditNote}
          {event.sourceUrl ? (
            <>
              {" "}
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="link">
                {E.whereFound}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="card">
        <EventForm
          action={updateEvent.bind(null, event.id)}
          submitLabel={event.status === "needs_review" ? E.saveAndApprove : E.save}
          organisers={await db.organiser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })}
          initial={{
            name: event.name,
            startDate: dateInput(event.startDate),
            endDate: event.endDate ? dateInput(event.endDate) : "",
            time: event.time ?? "",
            city: event.city,
            country: event.country,
            tickets: event.tickets ?? "",
            eventType: event.eventType,
            announceStatus: event.announceStatus,
            organiserId: event.organiserId ?? "",
            venue: event.venue ?? "",
            address: event.address ?? "",
            mapUrl: event.mapUrl ?? "",
            url: event.url ?? "",
            sourceUrl: event.sourceUrl ?? "",
            notes: event.notes ?? "",
          }}
        />
      </div>
      <form action={deleteEvent.bind(null, event.id)} className="mt-6">
        <ConfirmButton className="btn-danger w-full sm:w-auto" message={E.deleteConfirm(event.name)}>
          {E.delete}
        </ConfirmButton>
      </form>
    </>
  );
}
