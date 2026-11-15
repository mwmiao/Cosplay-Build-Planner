import { describe, expect, it } from "vitest";
import { rememberOnEdit, toggleDone } from "@/lib/partStatus";

describe("toggleDone", () => {
  it("remembers the previous status when ticking done", () => {
    expect(toggleDone("needed", null)).toEqual({ status: "done", statusBeforeDone: "needed" });
  });
  it("restores the remembered status when un-ticking", () => {
    expect(toggleDone("done", "needed")).toEqual({ status: "needed", statusBeforeDone: null });
    expect(toggleDone("done", "ordered")).toEqual({ status: "ordered", statusBeforeDone: null });
  });
  it("falls back to building when nothing usable is remembered", () => {
    expect(toggleDone("done", null).status).toBe("building");
    expect(toggleDone("done", "done").status).toBe("building");
    expect(toggleDone("done", "nonsense").status).toBe("building");
  });
});

describe("rememberOnEdit", () => {
  it("remembers the status the part had when it becomes done", () => {
    expect(rememberOnEdit({ status: "ordered", statusBeforeDone: null }, "done")).toBe("ordered");
  });
  it("keeps the remembered status while it stays done", () => {
    expect(rememberOnEdit({ status: "done", statusBeforeDone: "needed" }, "done")).toBe("needed");
  });
  it("clears it when the part is not done", () => {
    expect(rememberOnEdit({ status: "done", statusBeforeDone: "needed" }, "building")).toBeNull();
    expect(rememberOnEdit({ status: "needed", statusBeforeDone: null }, "ordered")).toBeNull();
  });
});
