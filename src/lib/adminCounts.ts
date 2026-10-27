import "server-only";
import { db } from "./db";

/** Things waiting for an admin: items to review and unread notifications (admins only). */
export async function adminCounts(): Promise<{ toReview: number; unread: number }> {
  const [posts, events, updates, changes, unread] = await Promise.all([
    db.instagramPost.count({ where: { reviewStatus: "pending_review" } }),
    db.event.count({ where: { status: "pending_review", source: { not: "instagram" } } }),
    db.eventUpdate.count({ where: { status: "pending_review" } }),
    db.event.count({ where: { pendingChange: { not: null }, status: { not: "rejected" } } }),
    db.adminNotification.count({ where: { readAt: null } }),
  ]);
  return { toReview: posts + events + updates + changes, unread };
}
