import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ResetForm } from "../forms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.resetTitle };
}

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const { t } = getI18n();
  const A = t.auth;
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-bold">{A.resetTitle}</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-4 text-center text-sm">
          <p role="alert">{A.resetInvalid}</p>
          <Link href="/forgot-password" className="link">
            {A.forgotTitle}
          </Link>
        </div>
      )}
    </>
  );
}
