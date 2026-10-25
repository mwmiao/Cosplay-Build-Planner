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
import type { FormState } from "@/lib/validation";

const loginSchema = z.object({ password: z.string().min(1, "Enter the password").max(500) });

function clientId(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = clientId();
  if (loginBlocked(id)) {
    return { ok: false, message: "Too many attempts. Wait 15 minutes and try again." };
  }
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  if (!passwordMatches(parsed.data.password)) {
    recordLoginFailure(id);
    return { ok: false, errors: { password: ["That password isn't right"] } };
  }
  clearLoginFailures(id);
  await startSession();
  redirect("/projects");
}

export async function logout(): Promise<void> {
  endSession();
  redirect("/login");
}
