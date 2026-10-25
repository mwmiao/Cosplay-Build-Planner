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
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link href="/community" className="flex items-center gap-2 font-bold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            {t.app.shortName}
          </Link>
          <Link href="/login?next=%2Fcommunity" className="btn-secondary min-h-9">
            {t.auth.submitLogin}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
