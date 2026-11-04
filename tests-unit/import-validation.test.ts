import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { EXPORT_FORMAT, EXPORT_SCHEMA_VERSION } from "@/lib/transfer/format";
import { parseImportText } from "@/lib/transfer/import";

// Imported files are untrusted: valid ones are accepted, malformed ones fail with a message and nothing else happens.

const part = (over: Record<string, unknown> = {}) => ({
  id: "part-1", name: "Wig", category: "wig", status: "needed", currency: "EUR", quantity: 1,
  estimatedCostCents: 2500, actualCostCents: null, supplier: null, url: null, notes: null,
  completedAt: null, createdAt: "2026-10-01T10:00:00.000Z", payment: null, ...over,
});
const file = (over: Record<string, unknown> = {}) => ({
  format: EXPORT_FORMAT, schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: "2026-10-26T09:00:00.000Z",
  project: { characterName: "Test", series: null, conventionName: null, deadline: null, status: "idea", currency: "EUR", budgetCents: null, notes: null },
  parts: [part()], ...over,
});
const parse = (v: unknown) => parseImportText(typeof v === "string" ? v : JSON.stringify(v), en);

describe("project import", () => {
  it("accepts a valid file and fills defaults for optional sections", () => {
    const r = parse(file());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.shoppingItems).toEqual([]);
      expect(r.file.references).toEqual([]);
      expect(r.file.parts[0]!.estimatedCostCents).toBe(2500);
    }
  });

  it.each([
    ["not JSON", "{nope"],
    ["not a project export", { hello: "world" }],
    ["array", []],
    ["null", null],
    ["newer version", file({ schemaVersion: 99 })],
    ["unknown version", file({ schemaVersion: 0 })],
  ])("rejects %s with a readable message", (_name, input) => {
    const r = parse(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects a file over the size limit", () => {
    const r = parse(JSON.stringify(file({ notes: "x".repeat(6 * 1024 * 1024) })));
    expect(r.ok).toBe(false);
  });

  it.each([
    ["non-http link", { parts: [part({ url: "javascript:alert(1)" })] }],
    ["negative cost", { parts: [part({ estimatedCostCents: -1 })] }],
    ["fractional cents", { parts: [part({ estimatedCostCents: 10.5 })] }],
    ["quantity 0", { parts: [part({ quantity: 0 })] }],
    ["unknown status", { parts: [part({ status: "stolen" })] }],
    ["unknown currency", { parts: [part({ currency: "ZZZ" })] }],
    ["empty name", { parts: [part({ name: "  " })] }],
    ["payment in another base currency", { parts: [part({ actualCostCents: 100, payment: { paidAt: "2026-10-02", baseCurrency: "USD", baseAmountCents: 110, fxRate: 1.1, fxRateDate: "2026-10-02", fxSource: "x", fxManual: false } })] }],
    ["duplicate part ids", { parts: [part(), part()] }],
  ])("rejects %s", (_name, over) => {
    expect(parse(file(over)).ok).toBe(false);
  });
});
