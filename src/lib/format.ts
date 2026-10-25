const currency = new Intl.NumberFormat(undefined, {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats cents as a plain amount (no currency symbol, so it suits any currency). */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return currency.format(cents / 100);
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
