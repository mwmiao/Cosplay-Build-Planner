"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { EmailUnavailableError, emailConfigured } from "@/lib/email";
import { clearGuestKey, deleteGuest, issueGuestKey } from "@/lib/guest";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/passwordRules";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { FormState } from "@/lib/validation";


/**
 * Request headers for sign-in/sign-up. The current session cookie is only
 * passed on for a guest (so their data can move to the account). A stale
 * cookie (expired, or removed by set-admin) must not be sent: Better Auth's
 * guest plugin would see it and clear the cookie, undoing the new login.
 */
async function authHeaders(): Promise<Headers> {
  const h = new Headers(headers());
  const user = await getCurrentUser();
  if (!user?.isGuest) h.delete("cookie");
  return h;
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const A = t.auth;
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const ip = clientIp();
  // Per address and per account, so neither guessing many passwords nor many accounts works.
  if (!(await rateLimit(`login-ip:${ip}`, 20, 15 * 60)) || !(await rateLimit(`login-email:${email}`, 8, 15 * 60))) {
    return { ok: false, message: A.tooMany };
  }
  if (!email || !password) return { ok: false, message: A.invalidCredentials };
  try {
    await getAuth().api.signInEmail({ body: { email, password, rememberMe: true }, headers: await authHeaders() });
  } catch {
    // Same message whether the email exists or not.
    return { ok: false, message: A.invalidCredentials };
  }
  redirect(safeNext(field(formData, "next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const A = t.auth;
  if (!(await rateLimit(`register-ip:${clientIp()}`, 10, 60 * 60))) return { ok: false, message: A.tooMany };

  const parsed = z
    .object({
      name: z.string().trim().min(1, t.validation.required(A.displayName)).max(60, t.validation.tooLong(60)),
      email: z.string().trim().toLowerCase().email(A.emailInvalid).max(254),
      password: z.string().min(PASSWORD_MIN, A.passwordTooShort(PASSWORD_MIN)).max(PASSWORD_MAX, A.passwordTooLong),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: A.passwordsDiffer })
    .safeParse({
      name: field(formData, "name"),
      email: field(formData, "email"),
      password: field(formData, "password"),
      confirm: field(formData, "confirm"),
    });
  if (!parsed.success) {
    return { ok: false, message: t.common.fixFields, errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await getAuth().api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
      headers: await authHeaders(),
    });
  } catch {
    return { ok: false, message: A.registerFailed };
  }
  redirect("/projects");
}

/** "Try without an account": a guest session plus the guest's own image key (kept only in their browser). */
export async function startGuest(): Promise<void> {
  if (await getCurrentUser()) redirect("/projects");
  if (!(await rateLimit(`guest-ip:${clientIp()}`, 10, 24 * 60 * 60))) redirect("/login?error=guest-limit");
  await getAuth().api.signInAnonymous({ headers: headers() });
  issueGuestKey();
  redirect("/projects?welcome=guest");
}

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  try {
    await getAuth().api.signOut({ headers: headers() });
  } catch {
    /* already signed out */
  }
  // A guest can't log back in, so leaving guest mode deletes their data now.
  if (user?.isGuest) {
    await deleteGuest(user.id);
    clearGuestKey();
  }
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const A = t.auth;
  // Never pretend to send an email when none can be sent.
  if (!emailConfigured()) return { ok: false, message: A.emailUnavailableTitle };
  const email = field(formData, "email").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, errors: { email: [A.emailInvalid] } };
  if (!(await rateLimit(`reset-ip:${clientIp()}`, 10, 60 * 60)) || !(await rateLimit(`reset-email:${email}`, 3, 60 * 60))) {
    return { ok: false, message: A.tooMany };
  }
  try {
    // Better Auth answers the same way whether or not the account exists.
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: headers() });
  } catch (err) {
    if (err instanceof EmailUnavailableError) return { ok: false, message: A.emailUnavailableTitle };
    console.error("Password reset email failed", err);
    return { ok: false, message: A.sendFailed };
  }
  return { ok: true, message: A.resetSent };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const A = t.auth;
  if (!(await rateLimit(`reset-submit-ip:${clientIp()}`, 20, 15 * 60))) return { ok: false, message: A.tooMany };
  const token = field(formData, "token");
  const password = field(formData, "password");
  if (password.length < PASSWORD_MIN) return { ok: false, errors: { password: [A.passwordTooShort(PASSWORD_MIN)] } };
  if (password.length > PASSWORD_MAX) return { ok: false, errors: { password: [A.passwordTooLong] } };
  if (password !== field(formData, "confirm")) return { ok: false, errors: { confirm: [A.passwordsDiffer] } };
  try {
    // Single use: Better Auth deletes the token when it's redeemed (and rejects expired ones).
    await getAuth().api.resetPassword({ body: { token, newPassword: password }, headers: headers() });
  } catch {
    return { ok: false, message: A.resetInvalid };
  }
  return { ok: true, message: A.resetDone };
}
