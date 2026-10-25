import "server-only";
import { z } from "zod";
import { db } from "./db";

/**
 * Exchange rates.
 *
 * - Current rates (for estimates of planned costs) come from open.er-api.com
 *   (updated daily, 160+ currencies), falling back to the European Central Bank
 *   via Frankfurter. They're cached in the ExchangeRate table and refreshed at
 *   most every 6 hours; when offline the last cached rates are used.
 * - Historical rates (for converting a payment on its payment date) come from
 *   the ECB via Frankfurter, which has daily rates back to 1999 for ~30
 *   currencies. For other currencies, a payment from the last few days uses the
 *   current rate; older ones need the charged amount typed in.
 */

const STALE_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5000;
const RECENT_DAYS = 3;

export const SOURCE_ER_API = "ExchangeRate-API (open.er-api.com)";
export const SOURCE_ECB = "European Central Bank (via Frankfurter)";

export type RateTable = {
  /** 1 EUR = rates.get(code) units of code. Always contains EUR = 1. */
  rates: Map<string, number>;
  source: string | null;
  rateDate: string | null;
  fetchedAt: Date | null;
};

export type ConvertedRate = { rate: number; rateDate: string; source: string };

export class RateUnavailableError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
    readonly date: string,
  ) {
    super(`No exchange rate ${from}→${to} for ${date}`);
  }
}

const erApiSchema = z.object({
  result: z.literal("success"),
  base_code: z.literal("EUR"),
  time_last_update_unix: z.number(),
  rates: z.record(z.number().positive()),
});

const frankfurterSchema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.number().positive()),
});

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchLatestFromProviders(): Promise<{ rates: Record<string, number>; source: string; rateDate: string }> {
  try {
    const d = erApiSchema.parse(await fetchJson("https://open.er-api.com/v6/latest/EUR"));
    return {
      rates: d.rates,
      source: SOURCE_ER_API,
      rateDate: new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10),
    };
  } catch (err) {
    console.warn("Exchange rates: open.er-api failed, trying Frankfurter", err);
  }
  const d = frankfurterSchema.parse(await fetchJson("https://api.frankfurter.dev/v1/latest?base=EUR"));
  return { rates: d.rates, source: SOURCE_ECB, rateDate: d.date };
}

let inflight: Promise<void> | null = null;
let lastFailure = 0;

/** Fetches current rates and stores them. Concurrent calls share one request. */
export function refreshLatestRates(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const latest = await fetchLatestFromProviders();
        const fetchedAt = new Date();
        await db.$transaction(
          Object.entries(latest.rates)
            .filter(([code]) => /^[A-Z]{3}$/.test(code))
            .map(([currency, ratePerEur]) =>
              db.exchangeRate.upsert({
                where: { currency },
                create: { currency, ratePerEur, source: latest.source, rateDate: latest.rateDate, fetchedAt },
                update: { ratePerEur, source: latest.source, rateDate: latest.rateDate, fetchedAt },
              }),
            ),
        );
        lastFailure = 0;
      } catch (err) {
        lastFailure = Date.now();
        throw err;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

async function readTable(): Promise<RateTable> {
  const rows = await db.exchangeRate.findMany();
  const rates = new Map<string, number>([["EUR", 1]]);
  let newest: (typeof rows)[number] | null = null;
  for (const r of rows) {
    rates.set(r.currency, r.ratePerEur);
    if (!newest || r.fetchedAt > newest.fetchedAt) newest = r;
  }
  return {
    rates,
    source: newest?.source ?? null,
    rateDate: newest?.rateDate ?? null,
    fetchedAt: newest?.fetchedAt ?? null,
  };
}

/** Current rates, refreshed when older than 6 hours (cached rates if offline). */
export async function getLatestRates(): Promise<RateTable> {
  const table = await readTable();
  const stale = !table.fetchedAt || Date.now() - table.fetchedAt.getTime() > STALE_MS;
  if (stale && Date.now() - lastFailure > RETRY_AFTER_FAILURE_MS) {
    try {
      await refreshLatestRates();
      return readTable();
    } catch (err) {
      console.warn("Exchange rates: refresh failed, using cached rates", err);
    }
  }
  return table;
}

/** Units of `to` per 1 unit of `from`, or null if either rate is unknown. */
export function crossRate(table: RateTable, from: string, to: string): number | null {
  if (from === to) return 1;
  const f = table.rates.get(from);
  const t = table.rates.get(to);
  return f && t ? t / f : null;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Rate for converting a payment made on `date` (YYYY-MM-DD) from `from` to `to`.
 * Throws RateUnavailableError when no trustworthy rate for that date exists.
 */
export async function historicalRate(from: string, to: string, date: string): Promise<ConvertedRate> {
  if (from === to) return { rate: 1, rateDate: date, source: "Same currency" };

  // ECB reference rates for the payment date (or the last business day before it).
  try {
    const d = frankfurterSchema.parse(
      await fetchJson(
        `https://api.frankfurter.dev/v1/${date}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
      ),
    );
    const rate = d.rates[to];
    if (rate) return { rate, rateDate: d.date, source: SOURCE_ECB };
  } catch (err) {
    console.warn(`Exchange rates: no ECB rate ${from}→${to} for ${date}`, err);
  }

  // Currencies the ECB doesn't publish: only trust current rates for recent payments.
  if (daysBetween(date, todayUtc()) <= RECENT_DAYS) {
    const table = await getLatestRates();
    const rate = crossRate(table, from, to);
    if (rate && table.rateDate && table.source) {
      return { rate, rateDate: table.rateDate, source: table.source };
    }
  }

  throw new RateUnavailableError(from, to, date);
}
