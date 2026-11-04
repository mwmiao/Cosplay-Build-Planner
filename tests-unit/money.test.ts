import { describe, expect, it } from "vitest";
import { projectStats } from "@/lib/projects";
import type { RateTable } from "@/lib/rates";

// 1 EUR = 1.1 USD = 0.85 GBP
const rates: RateTable = { rates: new Map([["EUR", 1], ["USD", 1.1], ["GBP", 0.85]]), source: "test", rateDate: "2026-11-01", fetchedAt: null };
const ctx = { defaultCurrency: "EUR", rates };
const project = { status: "building", budgetCents: 50_000, currency: null };
const part = (over: Record<string, unknown>) => ({
  status: "needed", currency: null, estimatedCostCents: null, actualCostCents: null, quantity: 1, paidAt: null, paidBaseCents: null, ...over,
}) as Parameters<typeof projectStats>[1][number];

describe("projectStats", () => {
  it("keeps stored payment conversions and never redoes them at today's rate", () => {
    const paid = part({ status: "done", currency: "USD", actualCostCents: 11_000, paidAt: new Date("2025-01-01"), paidBaseCents: 9_000 });
    const s = projectStats(project, [paid], ctx);
    expect(s.paid).toBe(9_000); // not 11000 / 1.1 = 10000
    expect(s.paidCount).toBe(1);
    expect(s.planned).toBe(0);
  });

  it("plans unpaid parts: actual cost wins over estimate, times quantity, converted", () => {
    const s = projectStats(
      project,
      [
        part({ estimatedCostCents: 1_000, quantity: 3 }), // 3000 EUR
        part({ estimatedCostCents: 1_000, actualCostCents: 2_000 }), // actual wins: 2000
        part({ currency: "USD", estimatedCostCents: 1_100, quantity: 2 }), // 2200 USD -> 2000 EUR
        part({}), // no cost: ignored
      ],
      ctx,
    );
    expect(s.planned).toBe(7_000);
    expect(s.plannedConverted).toBe(true);
    expect(s.projected).toBe(7_000);
    expect(s.overUnder).toBe(43_000);
    expect(s.remaining).toBe(50_000);
  });

  it("reports currencies with no rate instead of guessing", () => {
    const s = projectStats(project, [part({ currency: "JPY", estimatedCostCents: 5_000 })], ctx);
    expect(s.missingRates).toEqual(["JPY"]);
    expect(s.planned).toBe(0);
  });

  it("uses the project's own currency as base, and has no budget figures without a budget", () => {
    const s = projectStats({ status: "idea", budgetCents: null, currency: "GBP" }, [part({ currency: "EUR", estimatedCostCents: 1_000 })], ctx);
    expect(s.base).toBe("GBP");
    expect(s.planned).toBe(850);
    expect(s.remaining).toBeNull();
    expect(s.overUnder).toBeNull();
  });

  it("shows negative over/under when over budget", () => {
    const s = projectStats({ ...project, budgetCents: 1_000 }, [part({ estimatedCostCents: 1_500 })], ctx);
    expect(s.overUnder).toBe(-500);
  });

  it("completion: share of done parts, and a finished project is always 100%", () => {
    const parts = [part({ status: "done" }), part({ status: "needed" }), part({ status: "done" }), part({ status: "ordered" })];
    expect(projectStats(project, parts, ctx).completion).toBe(50);
    expect(projectStats({ ...project, status: "finished" }, parts, ctx).completion).toBe(100);
    expect(projectStats(project, [], ctx).completion).toBe(0);
  });
});
