"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearLoginFailures,
  endSession,
  loginBlocked,
  passwordMatches,
  recordLoginFailure,
  startSession,
} from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import type { FormState } from "@/lib/validation";


function clientId(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = getI18n();
  const id = clientId();
  if (loginBlocked(id)) {
    return { ok: false, message: t.login.tooMany };
  }
  const loginSchema = z.object({ password: z.string().min(1, t.login.empty).max(500) });
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  if (!passwordMatches(parsed.data.password)) {
    recordLoginFailure(id);
    return { ok: false, errors: { password: [t.login.wrong] } };
  }
  clearLoginFailures(id);
  await startSession();
  redirect("/projects");
}

export async function logout(): Promise<void> {
  endSession();
  redirect("/login");
}
