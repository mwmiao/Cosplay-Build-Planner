import { getI18n } from "@/i18n/server";

/** Shown at once while a signed-in page is being prepared (the app renders on the server). */
export default async function AppLoading() {
  const { t } = await getI18n();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="sr-only">{t.common.loading}</p>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card h-24 animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
