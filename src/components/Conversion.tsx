import type { BuildPart } from "@prisma/client";
import { money, rateLabel } from "@/lib/format";

type Paid = Pick<
  BuildPart,
  | "currency"
  | "actualCostCents"
  | "quantity"
  | "paidAt"
  | "paidBaseCents"
  | "fxRate"
  | "fxRateDate"
  | "fxSource"
  | "fxManual"
>;

/** The stored conversion of a paid part: original amount, rate, date and source. */
export function ConversionDetails({ part, base }: { part: Paid; base: string }) {
  if (!part.paidAt || part.paidBaseCents === null) return null;
  const cur = part.currency ?? base;
  const original = part.actualCostCents === null ? null : part.actualCostCents * part.quantity;
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60">
      <dt className="text-zinc-500 dark:text-zinc-400">Paid</dt>
      <dd className="font-medium tabular-nums">
        {money(original, cur)}
        {cur !== base ? ` → ${money(part.paidBaseCents, base)}` : ""}
      </dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Rate</dt>
      <dd className="tabular-nums">{cur === base && !part.fxManual ? "Same currency" : rateLabel(part.fxRate, cur, base)}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Rate date</dt>
      <dd>{part.fxRateDate ?? "—"}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Source</dt>
      <dd>
        {part.fxSource ?? "—"} · {part.fxManual ? "manual" : "automatic"}
      </dd>
    </dl>
  );
}
