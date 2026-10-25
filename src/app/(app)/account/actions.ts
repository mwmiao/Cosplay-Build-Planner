"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/passwordRules";
import { rateLimit } from "@/lib/rateLimit";
import type { FormState } from "@/lib/validation";

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const { t } = getI18n();
  const parsed = z
    .string()
    .trim()
    .min(1, t.validation.required(t.auth.displayName))
    .max(60, t.validation.tooLong(60))
    .safeParse(field(formData, "name"));
  if (!parsed.success) return { ok: false, errors: { name: parsed.error.issues.map((i) => i.message) } };
  // Better Auth updates the signed-in user only (taken from the session cookie).
  await getAuth().api.updateUser({ body: { name: parsed.data }, headers: headers() });
  revalidatePath("/", "layout");
  return { ok: true, message: t.auth.nameSaved };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = getI18n();
  const A = t.auth;
  if (!(await rateLimit(`change-password:${user.id}`, 10, 15 * 60))) return { ok: false, message: A.tooMany };
  const current = field(formData, "current");
  const next = field(formData, "password");
  if (next.length < PASSWORD_MIN) return { ok: false, errors: { password: [A.passwordTooShort(PASSWORD_MIN)] } };
  if (next.length > PASSWORD_MAX) return { ok: false, errors: { password: [A.passwordTooLong] } };
  if (next !== field(formData, "confirm")) return { ok: false, errors: { confirm: [A.passwordsDiffer] } };
  try {
    await getAuth().api.changePassword({
      body: { currentPassword: current, newPassword: next, revokeOtherSessions: true },
      headers: headers(),
    });
  } catch {
    return { ok: false, errors: { current: [A.wrongPassword] } };
  }
  return { ok: true, message: A.passwordChanged };
}
