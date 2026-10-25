import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./constants";
import { authEnabled, env } from "./env";
import { SESSION_MAX_AGE_SECONDS, createSessionToken, verifySessionToken } from "./session";

export function passwordMatches(candidate: string): boolean {
  const password = env().APP_PASSWORD;
  if (!password) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(password).digest();
  return timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value, env().SESSION_SECRET);
}

/**
 * Checked in every server action, page layout and API route, in addition to
 * middleware, so a middleware bypass never exposes data.
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}

export async function startSession(): Promise<void> {
  const secret = env().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const token = await createSessionToken(secret);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

// Simple in-memory login throttle: 10 failures per 15 minutes per client.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; first: number }>();

export function loginBlocked(clientId: string): boolean {
  const entry = failures.get(clientId);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(clientId);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(clientId: string): void {
  const entry = failures.get(clientId);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(clientId, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(clientId: string): void {
  failures.delete(clientId);
}
