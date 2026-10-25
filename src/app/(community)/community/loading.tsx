import { getI18n } from "@/i18n/server";

export default function CommunityLoading() {
  const { t } = getI18n();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="sr-only">{t.community.loading}</p>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex h-32 animate-pulse gap-3">
            <div className="h-24 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
