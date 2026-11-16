import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ResetForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.auth.resetTitle };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const search = await searchParams;
  const { t } = await getI18n();
  const A = t.auth;
  const token = typeof search.token === "string" ? search.token : "";
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
