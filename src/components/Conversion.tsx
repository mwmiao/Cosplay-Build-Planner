import type { BuildPart } from "@prisma/client";
import { getI18n } from "@/i18n/server";

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
  const { t, f } = getI18n();
  const c = t.conversion;
  const cur = part.currency ?? base;
  const original = part.actualCostCents === null ? null : part.actualCostCents * part.quantity;
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60">
      <dt className="text-zinc-500 dark:text-zinc-400">{c.paid}</dt>
      <dd className="font-medium tabular-nums">
        {f.money(original, cur)}
        {cur !== base ? ` → ${f.money(part.paidBaseCents, base)}` : ""}
      </dd>
      <dt className="text-zinc-500 dark:text-zinc-400">{c.rate}</dt>
      <dd className="tabular-nums">{cur === base && !part.fxManual ? c.sameCurrency : f.rate(part.fxRate, cur, base)}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">{c.rateDate}</dt>
      <dd>{part.fxRateDate ?? "—"}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">{c.source}</dt>
      <dd>
        {part.fxSource ? (c.sources[part.fxSource] ?? part.fxSource) : "—"} · {part.fxManual ? c.manual : c.automatic}
      </dd>
    </dl>
  );
}
