import { describe, expect, it } from "vitest";
import { centsToDecimal, toCsv } from "@/lib/csv";
import { dateInput, daysLabel, daysUntil, hostname, moneyInput } from "@/lib/format";
import { reorderPositions } from "@/lib/ordering";

describe("csv", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    const out = toCsv([["name", "note"], ["a,b", 'say "hi"'], ["=SUM(A1)", "+1"], ["-2", "@x"], [null, undefined]]);
    expect(out.startsWith("\uFEFF")).toBe(true); // BOM for Excel
    const lines = out.slice(1).split("\r\n");
    expect(lines[1]).toBe('"a,b","say ""hi"""');
    expect(lines[2]).toBe("'=SUM(A1),'+1");
    expect(lines[3]).toBe("'-2,'@x");
    expect(lines[4]).toBe(",");
  });

  it("does not treat numbers as formulas", () => {
    expect(toCsv([[-5, 3]]).slice(1)).toBe("-5,3\r\n");
  });

  it("formats cents without rounding surprises", () => {
    expect(centsToDecimal(1250)).toBe("12.50");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(null)).toBe("");
    expect(moneyInput(1999)).toBe("19.99");
    expect(moneyInput(undefined)).toBe("");
  });
});

describe("format", () => {
  it("counts whole days to a deadline stored as UTC midnight", () => {
    const now = new Date(2026, 10, 4, 15, 30); // local 4 Nov 2026, afternoon
    expect(daysUntil(new Date("2026-11-04T00:00:00Z"), now)).toBe(0);
    expect(daysUntil(new Date("2026-11-14T00:00:00Z"), now)).toBe(10);
    expect(daysUntil(new Date("2026-11-01T00:00:00Z"), now)).toBe(-3);
    expect(daysUntil(null, now)).toBeNull();
  });

  it("labels days", () => {
    const t = { days: { none: "No deadline", today: "Today!", left: (n: number) => `${n} left`, ago: (n: number) => `${n} ago` } };
    expect(daysLabel(null, t)).toBe("No deadline");
    expect(daysLabel(0, t)).toBe("Today!");
    expect(daysLabel(5, t)).toBe("5 left");
    expect(daysLabel(-2, t)).toBe("2 ago");
  });

  it("date input and hostname helpers", () => {
    expect(dateInput(new Date("2026-03-09T00:00:00Z"))).toBe("2026-03-09");
    expect(dateInput(null)).toBe("");
    expect(hostname("https://www.example.com/a?b=1")).toBe("example.com");
    expect(hostname("not a url")).toBeNull();
    expect(hostname(null)).toBeNull();
  });
});

describe("reorderPositions", () => {
  it("keeps the same position slots and assigns them in the new order", () => {
    const rows = [{ id: "a", position: 0 }, { id: "b", position: 5 }, { id: "c", position: 9 }];
    expect(reorderPositions(rows, ["c", "a", "b"])).toEqual([{ id: "c", position: 0 }, { id: "a", position: 5 }, { id: "b", position: 9 }]);
  });

  it("spreads duplicate positions so the order is unambiguous", () => {
    const rows = [{ id: "a", position: 0 }, { id: "b", position: 0 }, { id: "c", position: 0 }];
    expect(reorderPositions(rows, ["b", "c", "a"]).map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("ignores repeated ids", () => {
    const rows = [{ id: "a", position: 1 }, { id: "b", position: 2 }];
    expect(reorderPositions(rows, ["b", "b", "a"])).toEqual([{ id: "b", position: 1 }, { id: "a", position: 2 }]);
  });
});
