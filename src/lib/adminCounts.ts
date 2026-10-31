import "server-only";
import { db } from "./db";

/**
 * Things waiting on the Moderation page: open reports (moderators and admins),
 * plus items to review and unread notifications (admins only).
 */
export async function adminCounts(user: { isAdmin: boolean }): Promise<{ reports: number; toReview: number; unread: number }> {
  const reports = await db.report.count({ where: { status: "open" } });
  if (!user.isAdmin) return { reports, toReview: 0, unread: 0 };
  const [posts, events, updates, changes, unread] = await Promise.all([
    db.instagramPost.count({ where: { reviewStatus: "pending_review" } }),
    db.event.count({ where: { status: "pending_review", source: { not: "instagram" } } }),
    db.eventUpdate.count({ where: { status: "pending_review" } }),
    db.event.count({ where: { pendingChange: { not: null }, status: { not: "rejected" } } }),
    db.adminNotification.count({ where: { readAt: null } }),
  ]);
  return { reports, toReview: posts + events + updates + changes, unread };
}
