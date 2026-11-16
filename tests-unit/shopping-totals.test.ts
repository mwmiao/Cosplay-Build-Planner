import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import type { RateTable } from "@/lib/rates";
import { convertedTotal, groupItems, itemCurrency, itemTotal, parseGroup, type ShoppingRow } from "@/lib/shoppingList";

// 1 EUR = 1.1 USD = 0.85 GBP
const rates: RateTable = { rates: new Map([["EUR", 1], ["USD", 1.1], ["GBP", 0.85]]), source: "test", rateDate: "2026-11-01", fetchedAt: null };
const ctx = { defaultCurrency: "EUR", rates };
const item = (over: Record<string, unknown>) =>
  ({ estimatedCostCents: null, quantity: 1, currency: null, supplier: null, category: "other", project: null, ...over }) as unknown as ShoppingRow;

describe("itemTotal", () => {
  it("multiplies cost by quantity, and treats no cost as 0", () => {
    expect(itemTotal({ estimatedCostCents: 250, quantity: 3 })).toBe(750);
    expect(itemTotal({ estimatedCostCents: null, quantity: 3 })).toBe(0);
  });
});

describe("itemCurrency", () => {
  it("uses own currency, then project currency, then the default", () => {
    expect(itemCurrency(item({ currency: "USD", project: { currency: "GBP" } }), ctx)).toBe("USD");
    expect(itemCurrency(item({ project: { currency: "GBP" } }), ctx)).toBe("GBP");
    expect(itemCurrency(item({ project: { currency: null } }), ctx)).toBe("EUR");
    expect(itemCurrency(item({}), ctx)).toBe("EUR");
  });
});

describe("convertedTotal", () => {
  it("sums same-currency items without marking them converted", () => {
    const r = convertedTotal([item({ estimatedCostCents: 1000 }), item({ estimatedCostCents: 500, quantity: 2 })], ctx);
    expect(r).toEqual({ total: 2000, converted: false, missing: [] });
  });

  it("converts foreign currency into the default", () => {
    const r = convertedTotal([item({ estimatedCostCents: 1100, currency: "USD" })], ctx);
    expect(r).toEqual({ total: 1000, converted: true, missing: [] });
  });

  it("skips currencies with no rate and lists each once", () => {
    const r = convertedTotal(
      [item({ estimatedCostCents: 1000 }), item({ estimatedCostCents: 300, currency: "JPY" }), item({ estimatedCostCents: 400, currency: "JPY" })],
      ctx,
    );
    expect(r).toEqual({ total: 1000, converted: false, missing: ["JPY"] });
  });

  it("ignores items without a cost", () => {
    const r = convertedTotal([item({ currency: "USD" }), item({ currency: "JPY" })], ctx);
    expect(r).toEqual({ total: 0, converted: false, missing: [] });
  });
});

describe("parseGroup", () => {
  it("accepts category and project, defaults to supplier", () => {
    expect(parseGroup("category")).toBe("category");
    expect(parseGroup("project")).toBe("project");
    expect(parseGroup(undefined)).toBe("supplier");
    expect(parseGroup("x")).toBe("supplier");
  });
});

describe("groupItems", () => {
  it("groups by supplier, alphabetical, with the no-supplier bucket last", () => {
    const groups = groupItems(
      [
        item({ supplier: null }),
        item({ supplier: "Zed Shop" }),
        item({ supplier: "   " }),
        item({ supplier: "Alpha Shop" }),
      ],
      "supplier",
      en,
    );
    expect(groups.map(([key]) => key)).toEqual(["Alpha Shop", "Zed Shop", en.shopping.noSupplier]);
    expect(groups[2]?.[1]).toHaveLength(2);
  });
});
