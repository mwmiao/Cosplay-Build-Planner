import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./betterAuth";

import { guestExpiresAt } from "./guest";

export type CurrentUser = {
  id: string;
  name: string;
  /** Empty for guests */
  email: string;
  isAdmin: boolean;
  /** "Try without an account" user: private only, removed at guestExpiresAt unless they register */
  isGuest: boolean;
  guestExpiresAt: Date | null;
};

/**
 * The signed-in user, validated server-side against the session table on
 * every request (cached for the duration of one request).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: headers() });
  if (!session) return null;
  const isGuest = session.user.isAnonymous === true;
  return {
    id: session.user.id,
    name: session.user.name,
    email: isGuest ? "" : session.user.email,
    isAdmin: !isGuest && session.user.role === "admin",
    isGuest,
    guestExpiresAt: isGuest ? guestExpiresAt(new Date(session.user.createdAt)) : null,
  };
});

/** Use in every page, action and route that touches private data. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/projects");
  return user;
}

/** Things that need a real account (publishing, suggesting events). Guests are sent to registration. */
export async function requireAccount(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.isGuest) redirect("/register?from=guest");
  return user;
}

/** Moderation pages and actions. Non-admins get a plain 404 (the area doesn't "exist" for them). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/projects";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/projects";
  if (/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(next)) return "/projects";
  return next;
}
