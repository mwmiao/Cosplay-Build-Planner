// Formatting helpers. Language-dependent ones come from formatters(intl), so
// numbers and dates follow the UI language (e.g. "€12.50" vs "12,50 €").

const cache = new Map<string, ReturnType<typeof build>>();

function build(intl: string) {
  const plain = new Intl.NumberFormat(intl, { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const byCurrency = new Map<string, Intl.NumberFormat>();

  return {
    /**
     * Formats stored cents. With a currency code it shows the symbol and that
     * currency's usual decimals (e.g. "€12.50", "¥1,500"); without, a plain amount.
     */
    money(cents: number | null | undefined, currency?: string | null): string {
      if (cents === null || cents === undefined) return "—";
      if (!currency) return plain.format(cents / 100);
      let f = byCurrency.get(currency);
      if (!f) {
        f = new Intl.NumberFormat(intl, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
        byCurrency.set(currency, f);
      }
      return f.format(cents / 100);
    },

    /** Exchange rate for display, e.g. "1 USD = 0.8887 EUR". */
    rate(rate: number | null | undefined, from: string, to: string): string {
      if (!rate) return "—";
      return `1 ${from} = ${rate.toLocaleString(intl, { maximumSignificantDigits: 5 })} ${to}`;
    },

    /** Stored dates are UTC midnight of the chosen day. */
    date(date: Date | null | undefined): string {
      if (!date) return "—";
      return date.toLocaleDateString(intl, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
    },

    dateTime(date: Date): string {
      return date.toLocaleString(intl, { dateStyle: "medium", timeStyle: "short" });
    },
  };
}

export function formatters(intl: string) {
  let f = cache.get(intl);
  if (!f) {
    f = build(intl);
    cache.set(intl, f);
  }
  return f;
}

export type Formatters = ReturnType<typeof formatters>;

/** Cents → value for an <input> ("12.50"), or "" when empty. */
export function moneyInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Dates are stored as UTC midnight of the chosen day. */
export function dateInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Whole days from today (server's local time zone) to the deadline day. */
export function daysUntil(deadline: Date | null | undefined, now = new Date()): number | null {
  if (!deadline) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((deadline.getTime() - today) / 86_400_000);
}

/** "12 days left" / "Today!" / "3 days ago" in the given dictionary's language. */
export function daysLabel(days: number | null, t: { days: { none: string; today: string; left: (n: number) => string; ago: (n: number) => string } }): string {
  if (days === null) return t.days.none;
  if (days === 0) return t.days.today;
  return days > 0 ? t.days.left(days) : t.days.ago(-days);
}

export function hostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
