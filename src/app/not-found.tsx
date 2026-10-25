import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="text-zinc-500 dark:text-zinc-400">That page or project doesn&apos;t exist (or was deleted).</p>
      <Link href="/projects" className="btn-primary">
        Back to projects
      </Link>
    </main>
  );
}
