import { describe, expect, it } from "vitest";
import { applyStatus, toggleTarget } from "@/lib/partStatus";

const completed = new Date("2026-01-02T03:04:05Z");
const notDone = (status: string) => ({ status, statusBeforeDone: null, completedAt: null });
const done = (statusBeforeDone: string | null) => ({ status: "done", statusBeforeDone, completedAt: completed });

describe("applyStatus", () => {
  it("remembers the previous status and the time when a part becomes done", () => {
    const next = applyStatus(notDone("ordered"), "done");
    expect(next).toMatchObject({ status: "done", statusBeforeDone: "ordered" });
    expect(next.completedAt).toBeInstanceOf(Date);
  });
  it("keeps what it remembered while the part stays done", () => {
    expect(applyStatus(done("needed"), "done")).toEqual(done("needed"));
  });
  it("clears it when the part is not done", () => {
    expect(applyStatus(done("needed"), "building")).toEqual(notDone("building"));
    expect(applyStatus(notDone("needed"), "ordered")).toEqual(notDone("ordered"));
  });
});

describe("toggleTarget", () => {
  it("ticks a part done", () => {
    expect(toggleTarget(notDone("needed"))).toBe("done");
  });
  it("un-ticks to the remembered status", () => {
    expect(toggleTarget(done("needed"))).toBe("needed");
    expect(toggleTarget(done("ordered"))).toBe("ordered");
  });
  it("falls back to building when nothing is remembered", () => {
    expect(toggleTarget(done(null))).toBe("building");
  });
});
