import { describe, expect, it } from "vitest";
import { buildPublicSnapshot, parseSnapshot, parseTags, type PublishOptions } from "@/lib/community/snapshot";
import type { RateTable } from "@/lib/rates";

// 1 EUR = 1.1 USD = 0.85 GBP
const rates: RateTable = { rates: new Map([["EUR", 1], ["USD", 1.1], ["GBP", 0.85]]), source: "test", rateDate: "2026-11-01", fetchedAt: null };
const ctx = { defaultCurrency: "EUR", rates };
const project = { status: "building", budgetCents: 50_000, currency: null };

// Every part carries obviously private values that must never be published.
const part = (over: Record<string, unknown>) =>
  ({
    name: "Part",
    category: "fabric",
    status: "needed",
    currency: null,
    estimatedCostCents: null,
    actualCostCents: 99_999,
    quantity: 1,
    supplier: "SUPPLIER-MARKER",
    url: "https://example.com/URL-MARKER",
    paidAt: new Date("2026-01-01"),
    paidBaseCents: 88_888,
    ...over,
  }) as unknown as Parameters<typeof buildPublicSnapshot>[1][number];

const none: PublishOptions = { includeBudget: false, includeCosts: false, includeLinks: false };
const all: PublishOptions = { includeBudget: true, includeCosts: true, includeLinks: true };

const unpaid = { actualCostCents: null, paidAt: null, paidBaseCents: null };
const parts = [
  part({ name: "Wig", status: "done", currency: "USD", estimatedCostCents: 3_000, actualCostCents: 11_000, paidAt: new Date("2025-01-01"), paidBaseCents: 9_000 }),
  part({ name: "Fabric", estimatedCostCents: 1_000, quantity: 3, ...unpaid }),
  part({ name: "Boots", status: "done", ...unpaid }),
  part({ name: "Paint", ...unpaid }),
];

describe("buildPublicSnapshot", () => {
  it("with no options exposes only name, category, status, quantity and no budget", () => {
    const snap = buildPublicSnapshot(project, parts, none, ctx);
    expect(snap.v).toBe(1);
    expect(snap.budget).toBeNull();
    for (const i of snap.items) expect(Object.keys(i).sort()).toEqual(["category", "name", "quantity", "status"]);
  });

  it("never leaks private payment data, even with every option on", () => {
    // Two paid parts whose private amounts do not appear verbatim in the (legitimately published) totals.
    const paid = [part({ name: "A", estimatedCostCents: 500 }), part({ name: "B", estimatedCostCents: 700, paidBaseCents: 1_234 })];
    const json = JSON.stringify(buildPublicSnapshot(project, paid, all, ctx));
    for (const forbidden of ["99999", "88888", "paidAt", "actualCostCents", "paidBaseCents", "2026-01-01"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("includeBudget adds budget totals", () => {
    const snap = buildPublicSnapshot(project, parts, { ...none, includeBudget: true }, ctx);
    // paid: Wig's stored conversion 9000; planned: Fabric 3 x 1000
    const s = snap.budget!;
    expect(s.currency).toBe("EUR");
    expect(s.budgetCents).toBe(50_000);
    expect(s.spentCents).toBe(9_000);
    expect(s.plannedCents).toBe(3_000);
  });

  it("includeCosts adds the estimate (not the actual cost) and a currency", () => {
    const snap = buildPublicSnapshot(project, parts, { ...none, includeCosts: true }, ctx);
    expect(snap.items[0]).toMatchObject({ name: "Wig", estimatedEachCents: 3_000, currency: "USD" });
    expect(snap.items[1]).toMatchObject({ name: "Fabric", estimatedEachCents: 1_000, currency: "EUR" });
    expect(snap.items[2]?.estimatedEachCents).toBeNull();
  });

  it("includeLinks adds supplier and url only when on", () => {
    const withLinks = buildPublicSnapshot(project, parts, { ...none, includeLinks: true }, ctx);
    expect(withLinks.items[0]).toMatchObject({ supplier: "SUPPLIER-MARKER", url: "https://example.com/URL-MARKER" });
    const without = JSON.stringify(buildPublicSnapshot(project, parts, none, ctx));
    expect(without).not.toContain("SUPPLIER-MARKER");
    expect(without).not.toContain("URL-MARKER");
  });

  it("reports progress", () => {
    const snap = buildPublicSnapshot(project, parts.map((p, i) => ({ ...p, status: i < 2 ? "done" : "needed" })), none, ctx);
    expect(snap.progress).toEqual({ done: 2, count: 4, percent: 50 });
  });
});

describe("parseSnapshot", () => {
  const snap = () => buildPublicSnapshot(project, parts, all, ctx);

  it("round-trips a built snapshot", () => {
    const original = snap();
    expect(parseSnapshot(JSON.stringify(original))).toEqual(original);
  });

  it("rejects tampered snapshots", () => {
    const bad = (mutate: (s: any) => void) => {
      const s = JSON.parse(JSON.stringify(snap()));
      mutate(s);
      return JSON.stringify(s);
    };
    expect(() => parseSnapshot(bad((s) => { s.notes = "x"; }))).toThrow();
    expect(() => parseSnapshot(bad((s) => { s.items[0].paidAt = "x"; }))).toThrow();
    expect(() => parseSnapshot(bad((s) => { s.budget.extra = 1; }))).toThrow();
    expect(() => parseSnapshot(bad((s) => { s.progress.extra = 1; }))).toThrow();
    expect(() => parseSnapshot(bad((s) => { s.v = 2; }))).toThrow();
    expect(() => parseSnapshot(bad((s) => { s.items[0].quantity = 1.5; }))).toThrow();
    expect(() => parseSnapshot("not json")).toThrow();
  });
});

describe("parseTags", () => {
  it("returns string tags and tolerates bad input", () => {
    expect(parseTags('["a","b"]')).toEqual(["a", "b"]);
    expect(parseTags('["a",1,null]')).toEqual(["a"]);
    expect(parseTags('{"a":1}')).toEqual([]);
    expect(parseTags("not json")).toEqual([]);
  });
});
