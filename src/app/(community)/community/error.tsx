"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

/** Shown if loading Community data fails. No technical details reach the visitor. */
export default function CommunityError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
      <h2 className="font-semibold text-red-800 dark:text-red-300">{t.community.errorTitle}</h2>
      <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t.community.errorText}</p>
      <button type="button" onClick={reset} className="btn-secondary mt-4">
        {t.community.retry}
      </button>
    </div>
  );
}
