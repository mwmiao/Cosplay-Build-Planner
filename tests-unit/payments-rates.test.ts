import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPrivateAddress } from "@/lib/netGuard";
import { parseMoneyToCents } from "@/lib/validation";

const rows: Array<{ currency: string; ratePerEur: number; source: string; rateDate: string; fetchedAt: Date }> = [];
vi.mock("@/lib/db", () => ({
  db: {
    exchangeRate: { findMany: async () => rows, upsert: () => ({}) },
    $transaction: async () => [],
  },
}));

const { historicalRate, RateUnavailableError } = await import("@/lib/rates");
const { convertPayment } = await import("@/lib/payments");

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("parseMoneyToCents", () => {
  it.each([
    ["12.5", 1250],
    ["12,50", 1250],
    ["£12.50", 1250],
    ["1.500", 150_000],
    ["1,234", 123_400],
    ["1,234.56", 123_456],
    ["1.234,56", 123_456],
    ["1.234.567", 123_456_700],
    ["0.500", 50],
    ["0,5", 50],
    ["1500", 150_000],
    ["-3", -300],
  ])("%s → %i", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });
  it("rejects text without digits", () => {
    expect(parseMoneyToCents("abc")).toBeNaN();
  });
});

describe("isPrivateAddress", () => {
  it("catches IPv4-mapped IPv6 in dotted and hex form", () => {
    for (const ip of ["::ffff:192.168.0.1", "::ffff:c0a8:1", "::ffff:7f00:1", "::ffff:a9fe:a9fe"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("::ffff:808:808")).toBe(false); // 8.8.8.8
  });
});

describe("historicalRate fallback for currencies the ECB does not publish", () => {
  beforeEach(() => {
    rows.length = 0;
    // The ECB lookup fails (unsupported currency).
    vi.stubGlobal("fetch", async () => new Response("not found", { status: 404 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const seed = (rateDate: string, fetchedAt = new Date()) => {
    rows.push({ currency: "EUR", ratePerEur: 1, source: "test", rateDate, fetchedAt });
    rows.push({ currency: "XYZ", ratePerEur: 2, source: "test", rateDate, fetchedAt });
  };

  it("uses current rates for a recent payment", async () => {
    seed(today);
    const r = await historicalRate("XYZ", "EUR", daysAgo(1));
    expect(r.rate).toBeCloseTo(0.5);
  });

  it("refuses an old payment", async () => {
    seed(today);
    await expect(historicalRate("XYZ", "EUR", daysAgo(30))).rejects.toBeInstanceOf(RateUnavailableError);
  });

  it("refuses a recent payment when the cached rates are themselves old", async () => {
    seed(daysAgo(40), new Date());
    await expect(historicalRate("XYZ", "EUR", daysAgo(1))).rejects.toBeInstanceOf(RateUnavailableError);
  });
});

describe("convertPayment", () => {
  const input = { currency: "USD", actualCostCents: 1000, quantity: 2, paidAt: new Date("2025-01-10T00:00:00Z") };

  it("uses the typed charged amount and stores the implied rate", async () => {
    const r = await convertPayment({ ...input, chargedBaseCents: 1800 }, "EUR", null);
    expect(r).toMatchObject({ paidBaseCents: 1800, fxManual: true, fxRate: 0.9 });
  });

  it("converts at the payment-date rate", async () => {
    vi.stubGlobal(
      "fetch",
      async () => Response.json({ base: "USD", date: "2025-01-10", rates: { EUR: 0.9 } }),
    );
    const r = await convertPayment(input, "EUR", null);
    expect(r).toMatchObject({ paidBaseCents: 1800, fxRate: 0.9, fxRateDate: "2025-01-10", fxManual: false });
    vi.unstubAllGlobals();
  });

  it("keeps the stored conversion when nothing changed", async () => {
    const previous = {
      currency: "USD", actualCostCents: 1000, quantity: 2,
      paidAt: input.paidAt, paidBaseCents: 1234, fxRate: 0.617, fxRateDate: "2025-01-10", fxSource: "x", fxManual: false,
    };
    const r = await convertPayment(input, "EUR", previous);
    expect(r.paidBaseCents).toBe(1234);
  });
});
