import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEvent } from "../actions";
import { EventForm } from "../EventForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.add };
}

export default async function NewEventPage() {
  await requireAdmin();
  const { t } = getI18n();
  return (
    <>
      <BackLink href="/events">{t.events.title}</BackLink>
      <h1 className="page-title mb-4">{t.events.add}</h1>
      <div className="card">
        <EventForm
          action={createEvent}
          submitLabel={t.events.save}
          organisers={await db.organiser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })}
        />
      </div>
    </>
  );
}
