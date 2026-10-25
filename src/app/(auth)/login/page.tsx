import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { LoginForm } from "../forms";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getCurrentUser()) redirect(next);
  const { t } = getI18n();
  return (
    <>
      <h1 className="mb-1 text-center text-xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{t.auth.loginSubtitle}</p>
      <LoginForm next={next} />
    </>
  );
}
