import { describe, expect, it } from "vitest";
import { findDates } from "@/lib/events/caption";

const ref = new Date("2026-10-01T00:00:00Z");

describe("findDates", () => {
  it("reads real dates", () => {
    expect(findDates("29, 30 e 31 de outubro", ref)).toEqual({ start: "2026-10-29", end: "2026-10-31" });
    expect(findDates("7 nov", ref).start).toBe("2026-11-07");
  });
  it("does not take ordinary words for month names", () => {
    for (const text of ["15 outros expositores", "3 mais dias", "2 marcas convidadas", "10 mares de gente"]) {
      expect(findDates(text, ref), text).toEqual({});
    }
  });
});
