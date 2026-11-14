import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.auth.registerTitle };
}

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user && !user.isGuest) redirect("/projects");
  const { t } = await getI18n();
  const A = t.auth;
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-bold">{A.registerTitle}</h1>
      {user?.isGuest ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-900/40 dark:text-brand-100">
          {t.guest.registerKeeps}
        </p>
      ) : null}
      <RegisterForm />
    </>
  );
}
