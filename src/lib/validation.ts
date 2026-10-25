import { z } from "zod";
import { CATEGORIES, PART_STATUSES, PROJECT_STATUSES } from "./constants";

/** Turns blank form strings into undefined so optional fields stay optional. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().max(max, `Must be ${max} characters or fewer`).optional());

const requiredText = (max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `Must be ${max} characters or fewer`);

/** "12.5" / "12,50" / "£12.50" → 1250 cents. */
const optionalMoney = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    if (s === undefined) return undefined;
    if (typeof s !== "string") return s;
    const cleaned = s.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) && cleaned !== "" ? Math.round(n * 100) : Number.NaN;
  },
  z
    .number({ invalid_type_error: "Enter an amount like 12.50" })
    .int()
    .min(0, "Amount can't be negative")
    .max(100_000_000, "That amount is too large")
    .optional(),
);

const optionalUrl = z.preprocess(
  blankToUndefined,
  z
    .string()
    .max(2000)
    .url("Enter a full link starting with http:// or https://")
    .refine((u) => /^https?:\/\//i.test(u), "Only http:// and https:// links are allowed")
    .optional(),
);

const optionalDate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker (YYYY-MM-DD)")
    .transform((s) => {
      const [y, m, d] = s.split("-").map(Number) as [number, number, number];
      return new Date(Date.UTC(y, m - 1, d));
    })
    .refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
    .optional(),
);

const quantity = z.preprocess(
  (v) => blankToUndefined(v) ?? "1",
  z.coerce
    .number({ invalid_type_error: "Enter a whole number" })
    .int("Enter a whole number")
    .min(1, "At least 1")
    .max(9999, "That's a lot — 9999 max"),
);

export const projectSchema = z.object({
  characterName: requiredText(120, "Character name"),
  series: optionalText(120),
  conventionName: optionalText(120),
  deadline: optionalDate,
  status: z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: "Pick a status" }) }),
  budgetCents: optionalMoney,
  spentCents: optionalMoney,
  notes: optionalText(5000),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const partSchema = z.object({
  name: requiredText(120, "Part name"),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: "Pick a category" }) }),
  status: z.enum(PART_STATUSES, { errorMap: () => ({ message: "Pick a status" }) }),
  estimatedCostCents: optionalMoney,
  actualCostCents: optionalMoney,
  quantity,
  supplier: optionalText(120),
  url: optionalUrl,
  notes: optionalText(5000),
});
export type PartInput = z.infer<typeof partSchema>;

export const shoppingItemSchema = z.object({
  name: requiredText(120, "Item name"),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: "Pick a category" }) }),
  projectId: z.preprocess(blankToUndefined, z.string().cuid().optional()),
  supplier: optionalText(120),
  url: optionalUrl,
  quantity,
  estimatedCostCents: optionalMoney,
  notes: optionalText(2000),
});
export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>;

export const referenceSchema = z.object({
  caption: optionalText(200),
  sourceUrl: optionalUrl,
});

export const idSchema = z.string().cuid();

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/** Reads only string fields from FormData into a plain object. */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function errorState(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Please fix the highlighted fields.",
    errors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
