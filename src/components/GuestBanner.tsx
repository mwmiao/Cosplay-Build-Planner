import Link from "next/link";
import type { Dict } from "@/i18n";

/** Shown on every page while using a guest account: days left and how to keep the projects. */
export function GuestBanner({ expiresAt, t }: { expiresAt: Date; t: Dict }) {
  const G = t.guest;
  const days = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000));
  return (
    <div
      role="status"
      data-testid="guest-banner"
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm ${
        days <= 5
          ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
      }`}
    >
      <span>{G.banner(days)}</span>
      <span className="flex gap-2">
        <Link href="/register" className="btn-primary min-h-9">
          {G.createAccount}
        </Link>
        <Link href="/login" className="btn-ghost min-h-9">
          {G.logIn}
        </Link>
      </span>
    </div>
  );
}
