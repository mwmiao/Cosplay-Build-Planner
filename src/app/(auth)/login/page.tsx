import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { SubmitButton } from "@/components/FormBits";
import { GUEST_DAYS } from "@/lib/guest";
import { startGuest } from "../actions";
import { LoginForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const search = await searchParams;
  const next = safeNext(search.next);
  const user = await getCurrentUser();
  // Guests may log in to an existing account (their projects move into it).
  if (user && !user.isGuest) redirect(next);
  const { t } = await getI18n();
  const G = t.guest;
  return (
    <>
      <h1 className="mb-1 text-center text-xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{t.auth.loginSubtitle}</p>
      {user?.isGuest ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-900/40 dark:text-brand-100">
          {G.loginKeeps}
        </p>
      ) : null}
      {search.error === "guest-limit" ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {t.auth.tooMany}
        </p>
      ) : null}
      <LoginForm next={next} />
      {user ? null : (
        <form action={startGuest} className="mt-6 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
          <SubmitButton className="btn-secondary w-full" pendingText={t.common.working}>
            {G.tryWithout}
          </SubmitButton>
          <p className="hint mt-2">{G.tryWithoutHint(GUEST_DAYS)}</p>
        </form>
      )}
    </>
  );
}
