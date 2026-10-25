const plain = new Intl.NumberFormat(undefined, {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const byCurrency = new Map<string, Intl.NumberFormat>();

/**
 * Formats stored cents. With a currency code it shows the symbol and that
 * currency's usual decimals (e.g. "€12.50", "¥1,500"); without, a plain amount.
 */
export function money(cents: number | null | undefined, currency?: string | null): string {
  if (cents === null || cents === undefined) return "—";
  if (!currency) return plain.format(cents / 100);
  let f = byCurrency.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    byCurrency.set(currency, f);
  }
  return f.format(cents / 100);
}

/** Exchange rate for display, e.g. "1 USD = 0.8887 EUR". */
export function rateLabel(rate: number | null | undefined, from: string, to: string): string {
  if (!rate) return "—";
  return `1 ${from} = ${rate.toLocaleString(undefined, { maximumSignificantDigits: 5 })} ${to}`;
}

/** Cents → value for an <input> ("12.50"), or "" when empty. */
export function moneyInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Dates are stored as UTC midnight of the chosen day. */
export function dateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole days from today (server's local time zone) to the deadline day. */
export function daysUntil(deadline: Date | null | undefined, now = new Date()): number | null {
  if (!deadline) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((deadline.getTime() - today) / 86_400_000);
}

export function daysLabel(days: number | null): string {
  if (days === null) return "No deadline";
  if (days === 0) return "Today!";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "1 day ago";
  return `${-days} days ago`;
}

export function hostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
