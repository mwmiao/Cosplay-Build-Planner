import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { registrationOpen } from "@/lib/env";
import { RegisterForm } from "../forms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.registerTitle };
}

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/projects");
  const { t } = getI18n();
  const A = t.auth;
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-bold">{A.registerTitle}</h1>
      {registrationOpen() ? (
        <RegisterForm />
      ) : (
        <div className="space-y-4 text-center text-sm">
          <p className="font-medium">{A.registrationClosed}</p>
          <p className="hint">{A.registrationClosedHint}</p>
          <Link href="/login" className="link">
            {A.backToLogin}
          </Link>
        </div>
      )}
    </>
  );
}
