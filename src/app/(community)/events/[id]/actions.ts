"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validation";

const refresh = (eventId: string) => {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/projects", "layout");
};

/** "I'm going" (accounts only, approved events only). Private to that account. */
export async function setGoing(eventId: string, going: boolean): Promise<void> {
  const user = await requireAccount();
  if (!idSchema.safeParse(eventId).success) return;
  const key = { userId_eventId: { userId: user.id, eventId } };
  if (!going) await db.eventAttendance.deleteMany({ where: { userId: user.id, eventId } });
  else if (await db.event.findFirst({ where: { id: eventId, status: "approved" }, select: { id: true } })) {
    await db.eventAttendance.upsert({ where: key, create: { userId: user.id, eventId }, update: {} });
  }
  refresh(eventId);
}

/** Link the event to one of your own projects, or clear the link. */
export async function linkEventProject(eventId: string, formData: FormData): Promise<void> {
  const user = await requireAccount();
  if (!idSchema.safeParse(eventId).success) return;
  const value = formData.get("projectId");
  const projectId = typeof value === "string" && idSchema.safeParse(value).success ? value : null;
  // Ownership comes from the session: another user's project is treated as none.
  const project = projectId
    ? await db.project.findFirst({ where: { id: projectId, ownerId: user.id, deletedAt: null }, select: { id: true } })
    : null;
  await db.eventAttendance.updateMany({ where: { userId: user.id, eventId }, data: { projectId: project?.id ?? null } });
  refresh(eventId);
}
