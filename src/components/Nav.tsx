"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { CartIcon, CogIcon, FolderIcon, GlobeIcon, PlusIcon } from "./Icons";

function useItems() {
  const { t } = useI18n();
  return [
    {
      href: "/projects",
      label: t.nav.projects,
      long: t.nav.projects,
      Icon: FolderIcon,
      match: (p: string) => p.startsWith("/projects") && p !== "/projects/new",
    },
    { href: "/community", label: t.nav.community, long: t.nav.community, Icon: GlobeIcon, match: (p: string) => p.startsWith("/community") },
    { href: "/projects/new", label: t.nav.new, long: t.nav.newProject, Icon: PlusIcon, match: (p: string) => p === "/projects/new" },
    { href: "/shopping", label: t.nav.shopping, long: t.nav.shopping, Icon: CartIcon, match: (p: string) => p.startsWith("/shopping") },
    { href: "/settings", label: t.nav.settings, long: t.nav.settings, Icon: CogIcon, match: (p: string) => p.startsWith("/settings") },
  ];
}

/** Desktop sidebar with an account menu (name, Account page, log out) at the bottom. */
export function Sidebar({
  userName,
  isAdmin = false,
  signOut,
}: {
  userName: string;
  isAdmin?: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = useItems();
  return (
    <nav
      aria-label={t.nav.main}
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex"
    >
      <Link href="/projects" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        {t.app.shortName}
      </Link>
      {items.map(({ href, long, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon className="h-5 w-5" />
            {long}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-zinc-200 pt-3 dark:border-zinc-800">
        {isAdmin ? (
          <Link
            href="/admin"
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            className="mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
          >
            {t.admin.title}
          </Link>
        ) : null}
        <Link
          href="/account"
          aria-current={pathname.startsWith("/account") ? "page" : undefined}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{userName}</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">{t.auth.account}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button type="submit" className="btn-ghost mt-1 w-full justify-start">
            {t.auth.logout}
          </button>
        </form>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = useItems();
  return (
    <nav
      aria-label={t.nav.main}
      className="bottom-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-brand-600 dark:text-brand-400" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
