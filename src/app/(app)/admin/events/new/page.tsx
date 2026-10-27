import type { Metadata } from "next";
import { BackLink } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { createEvent } from "../actions";
import { EventForm } from "../EventForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.events.add };
}

type Extracted = { name?: string; start?: string; end?: string; time?: string; venue?: string; address?: string; city?: string; tickets?: string; ticketUrl?: string };

/** Add an event; with ?post=<id> ("Create event from post") the form starts from what the detector read. */
export default async function NewEventPage({ searchParams }: { searchParams: { post?: string } }) {
  await requireAdmin();
  const { t } = getI18n();
  const postId = idSchema.safeParse(searchParams.post);
  const post = postId.success
    ? await db.instagramPost.findUnique({ where: { id: postId.data }, include: { source: { include: { organiser: true } } } })
    : null;
  let x: Extracted = {};
  try {
    x = post?.extracted ? JSON.parse(post.extracted) : {};
  } catch {
    x = {};
  }
  const organiser = post?.source?.organiser;
  return (
    <>
      <BackLink href="/events">{t.events.title}</BackLink>
      <h1 className="page-title mb-4">{t.events.add}</h1>
      <div className="card">
        <EventForm
          action={createEvent}
          submitLabel={t.events.save}
          organisers={await db.organiser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })}
          postId={post?.id}
          initial={
            post
              ? {
                  name: x.name ?? organiser?.name ?? "",
                  startDate: x.start ?? "",
                  endDate: x.end ?? "",
                  time: x.time ?? "",
                  venue: x.venue ?? organiser?.usualVenue ?? "",
                  address: x.address ?? organiser?.usualAddress ?? "",
                  city: x.city ?? organiser?.city ?? "",
                  tickets: x.tickets ?? "",
                  url: x.ticketUrl ?? "",
                  sourceUrl: post.permalink ?? "",
                  eventType: organiser?.eventType ?? "other",
                  organiserId: organiser?.id ?? "",
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
