import Link from "next/link";
import { ChevronLeftIcon } from "./Icons";

const statusColors: Record<string, string> = {
  idea: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  researching: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  building: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  finished: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  needed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  ordered: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  arrived: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        statusColors[status] ?? statusColors.idea
      }`}
    >
      {label}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
    >
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <h3 className="font-semibold">{title}</h3>
      {children ? <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {children}
    </Link>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</div> : null}
    </div>
  );
}
