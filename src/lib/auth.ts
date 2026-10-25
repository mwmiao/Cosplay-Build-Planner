import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./betterAuth";

export type CurrentUser = { id: string; name: string; email: string; isAdmin: boolean };

/**
 * The signed-in user, validated server-side against the session table on
 * every request (cached for the duration of one request).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    isAdmin: session.user.role === "admin",
  };
});

/** Use in every page, action and route that touches private data. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
