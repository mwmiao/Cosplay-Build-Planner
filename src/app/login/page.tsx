import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { isAuthenticated } from "@/lib/auth";
import { authEnabled } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export function generateMetadata(): Metadata {
  return { title: getI18n().t.login.title };
}
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!authEnabled() || (await isAuthenticated())) redirect("/projects");
  const { t } = getI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <img src="/icon.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
        <h1 className="mb-1 text-center text-xl font-bold">{t.app.name}</h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{t.login.subtitle}</p>
        <LoginForm />
      </div>
    </main>
  );
}
