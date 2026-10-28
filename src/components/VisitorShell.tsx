import Link from "next/link";
import { getI18n } from "@/i18n/server";

/** Visitors without an account: a slim header with the public pages and a login link. Nothing private is loaded here. */
export function VisitorShell({ loginHref, children }: { loginHref: string; children: React.ReactNode }) {
  const { t } = getI18n();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200/80 bg-white/75 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 md:px-8">
          <Link href="/projects" className="flex shrink-0 items-center gap-2 font-bold" aria-label={t.app.shortName}>
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="hidden md:inline">{t.app.shortName}</span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-0.5" aria-label={t.app.shortName}>
            <Link href="/projects" className="btn-ghost min-h-9 px-2 sm:px-3">
              {t.nav.projects}
            </Link>
            <Link href="/community" className="btn-ghost min-h-9 px-2 sm:px-3">
              {t.nav.community}
            </Link>
            <Link href="/events" className="btn-ghost min-h-9 px-2 sm:px-3">
              {t.nav.events}
            </Link>
            <Link href={loginHref} className="btn-secondary min-h-9 px-3">
              {t.auth.submitLogin}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
