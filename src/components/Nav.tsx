"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, CogIcon, FolderIcon, PlusIcon } from "./Icons";

const items = [
  { href: "/projects", label: "Projects", Icon: FolderIcon, match: (p: string) => p.startsWith("/projects") && p !== "/projects/new" },
  { href: "/shopping", label: "Shopping", Icon: CartIcon, match: (p: string) => p.startsWith("/shopping") },
  { href: "/projects/new", label: "New", Icon: PlusIcon, match: (p: string) => p === "/projects/new" },
  { href: "/settings", label: "Settings", Icon: CogIcon, match: (p: string) => p.startsWith("/settings") },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex"
    >
      <Link href="/projects" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        Cosplay Planner
      </Link>
      {items.map(({ href, label, Icon, match }) => {
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
            {label === "New" ? "New project" : label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="bottom-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
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
