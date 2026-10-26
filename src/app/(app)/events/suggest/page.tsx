import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAccount } from "@/lib/auth";
import { suggestEvent } from "../../admin/events/actions";
import { EventForm } from "../../admin/events/EventForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.suggest };
}

/** Anyone with an account can suggest an event; an admin approves it. */
export default async function SuggestEventPage() {
  await requireAccount();
  const { t } = getI18n();
  const E = t.events;
  return (
    <>
      <BackLink href="/events">{E.title}</BackLink>
      <h1 className="page-title mb-1">{E.suggest}</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{E.suggestIntro}</p>
      <div className="card">
        <EventForm action={suggestEvent} submitLabel={E.sendSuggestion} suggest />
      </div>
    </>
  );
}
