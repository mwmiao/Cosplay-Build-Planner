import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { emailConfigured } from "@/lib/email";
import { ForgotForm } from "../forms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.forgotTitle };
}

export default function ForgotPasswordPage() {
  const { t } = getI18n();
  const A = t.auth;
  return (
    <>
      <h1 className="mb-2 text-center text-xl font-bold">{A.forgotTitle}</h1>
      {emailConfigured() ? (
        <>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{A.forgotIntro}</p>
          <ForgotForm />
        </>
      ) : (
        // No email service: say so plainly instead of pretending to send anything.
        <div className="space-y-4 text-sm">
          <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-semibold">{A.emailUnavailableTitle}</p>
            <p className="mt-1">{A.emailUnavailableText}</p>
          </div>
          <p className="text-center">
            <Link href="/login" className="link">
              {A.backToLogin}
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
