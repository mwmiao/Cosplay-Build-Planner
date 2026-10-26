import Link from "next/link";
import { BottomNav, Sidebar } from "@/components/Nav";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

/**
 * Community pages are public. Signed-in users get the normal app navigation;
 * visitors get a slim header with a login link. Nothing private is loaded here.
 */
export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const { t } = getI18n();
  if (user) {
    return (
      <div className="flex min-h-dvh">
        <Sidebar userName={user.name} isAdmin={user.isAdmin} signOut={signOut} />
        <main className="pb-safe-nav min-w-0 flex-1 md:pb-8">
          <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">{children}</div>
        </main>
        <BottomNav />
      </div>
    );
  }
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200/80 bg-white/75 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link href="/community" className="flex items-center gap-2 font-bold" aria-label={t.app.shortName}>
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden sm:inline">{t.app.shortName}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/community" className="btn-ghost min-h-9 px-3">
              {t.nav.community}
            </Link>
            <Link href="/events" className="btn-ghost min-h-9 px-3">
              {t.nav.events}
            </Link>
            <Link href="/login?next=%2Fcommunity" className="btn-secondary min-h-9">
              {t.auth.submitLogin}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
