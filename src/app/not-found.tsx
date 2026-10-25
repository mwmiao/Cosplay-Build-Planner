import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default function NotFound() {
  const { t } = getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t.notFound.title}</h1>
      <p className="text-zinc-500 dark:text-zinc-400">{t.notFound.text}</p>
      <Link href="/projects" className="btn-primary">
        {t.notFound.back}
      </Link>
    </main>
  );
}
