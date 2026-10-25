import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Centered card layout for login, registration and password reset. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = getI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="card w-full max-w-sm p-6">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
        <p className="mb-4 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t.app.name}</p>
        {children}
      </div>
    </main>
  );
}
