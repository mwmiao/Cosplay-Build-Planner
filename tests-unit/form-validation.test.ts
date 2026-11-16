import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { errorState, idSchema, schemas } from "@/lib/validation";

// Pins the user-facing form error messages so the zod upgrade cannot silently change them.

const s = schemas(en);
const v = en.validation;

const goodPart = { name: "Wig", category: "wig", status: "needed", currency: "EUR", quantity: "1" };
const goodProject = { characterName: "Test", status: "idea", currency: "EUR" };

function messages(schema: { safeParse: (x: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown, field: string) {
  const r = schema.safeParse(input);
  expect(r.success).toBe(false);
  return r.error!.issues.filter((i) => i.path[0] === field).map((i) => i.message);
}

describe("form validation messages", () => {
  it("accepts a valid part and project", () => {
    expect(s.part.safeParse(goodPart).success).toBe(true);
    expect(s.project.safeParse(goodProject).success).toBe(true);
  });

  it("required text field missing entirely", () => {
    const { characterName: _omit, ...rest } = goodProject;
    expect(messages(s.project, rest, "characterName")).toEqual([v.required(en.projectForm.characterName)]);
  });

  it("required text field blank", () => {
    expect(messages(s.project, { ...goodProject, characterName: "  " }, "characterName")).toEqual([
      v.required(en.projectForm.characterName),
    ]);
  });

  it("unreadable money amount", () => {
    expect(messages(s.part, { ...goodPart, estimatedCostCents: "abc" }, "estimatedCostCents")).toEqual([v.amount]);
  });

  it("non-integer quantity", () => {
    expect(messages(s.part, { ...goodPart, quantity: "abc" }, "quantity")).toEqual([v.wholeNumber]);
    expect(messages(s.part, { ...goodPart, quantity: "1.5" }, "quantity")).toEqual([v.wholeNumber]);
  });

  it("invalid currency, category and statuses", () => {
    expect(messages(s.part, { ...goodPart, currency: "XXX" }, "currency")).toEqual([v.pickCurrency]);
    expect(messages(s.part, { ...goodPart, category: "nope" }, "category")).toEqual([v.pickCategory]);
    expect(messages(s.project, { ...goodProject, status: "nope" }, "status")).toEqual([v.pickStatus]);
    expect(messages(s.part, { ...goodPart, status: "nope" }, "status")).toEqual([v.pickStatus]);
  });

  it("idSchema accepts a cuid and rejects junk", () => {
    expect(idSchema.safeParse("clh3am0k00000qzrmn831i7rn").success).toBe(true);
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("../etc").success).toBe(false);
  });

  it("errorState maps a failing field to its message", () => {
    const r = s.project.safeParse({ ...goodProject, status: "nope" });
    expect(r.success).toBe(false);
    expect(errorState(r.error!, en)).toEqual({
      ok: false,
      message: en.common.fixFields,
      errors: { status: [v.pickStatus] },
    });
  });
});
