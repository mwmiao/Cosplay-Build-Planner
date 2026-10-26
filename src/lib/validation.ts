import { z } from "zod";
import type { Dict } from "@/i18n";
import { CATEGORIES, PART_STATUSES, PROJECT_STATUSES } from "./constants";
import { CURRENCY_CODES } from "./currencies";

/** Turns blank form strings into undefined so optional fields stay optional. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v;

/** HTML checkbox: "on" when ticked, missing when not. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Form schemas with error messages in the user's language. */
export function schemas(t: Dict) {
  const v = t.validation;

  const optionalText = (max: number) =>
    z.preprocess(blankToUndefined, z.string().max(max, v.tooLong(max)).optional());

  const requiredText = (max: number, label: string) =>
    z
      .string({ required_error: v.required(label) })
      .trim()
      .min(1, v.required(label))
      .max(max, v.tooLong(max));

  /** "12.5" / "12,50" / "£12.50" → 1250 cents. */
  const optionalMoney = z.preprocess(
    (val) => {
      const s = blankToUndefined(val);
      if (s === undefined) return undefined;
      if (typeof s !== "string") return s;
      const cleaned = s.replace(/[^\d.,-]/g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) && cleaned !== "" ? Math.round(n * 100) : Number.NaN;
    },
    z
      .number({ invalid_type_error: v.amount })
      .int()
      .min(0, v.negative)
      .max(100_000_000, v.tooLarge)
      .optional(),
  );

  const optionalUrl = z.preprocess(
    blankToUndefined,
    z
      .string()
      .max(2000)
      .url(v.url)
      .refine((u) => /^https?:\/\//i.test(u), v.urlScheme)
      .optional(),
  );

  const optionalDate = z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, v.date)
      .transform((s) => {
        const [y, m, d] = s.split("-").map(Number) as [number, number, number];
        return new Date(Date.UTC(y, m - 1, d));
      })
      .refine((d) => !Number.isNaN(d.getTime()), v.invalidDate)
      .optional(),
  );

  const currency = z.enum(CURRENCY_CODES, { errorMap: () => ({ message: v.pickCurrency }) });
  const category = z.enum(CATEGORIES, { errorMap: () => ({ message: v.pickCategory }) });

  const quantity = z.preprocess(
    (val) => blankToUndefined(val) ?? "1",
    z.coerce
      .number({ invalid_type_error: v.wholeNumber })
      .int(v.wholeNumber)
      .min(1, v.atLeastOne)
      .max(9999, v.tooMany),
  );

  const project = z
    .object({
      characterName: requiredText(120, t.projectForm.characterName),
      series: optionalText(120),
      conventionName: optionalText(120),
      startDate: optionalDate,
      deadline: optionalDate,
      status: z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: v.pickStatus }) }),
      currency,
      budgetCents: optionalMoney,
      notes: optionalText(5000),
    })
    .superRefine((d, ctx) => {
      if (d.startDate && d.deadline && d.startDate > d.deadline) {
        ctx.addIssue({ code: "custom", path: ["deadline"], message: v.deadlineBeforeStart });
      }
    });

  const part = z
    .object({
      name: requiredText(120, t.partForm.name),
      category,
      status: z.enum(PART_STATUSES, { errorMap: () => ({ message: v.pickStatus }) }),
      currency,
      estimatedCostCents: optionalMoney,
      actualCostCents: optionalMoney,
      quantity,
      supplier: optionalText(120),
      url: optionalUrl,
      notes: optionalText(5000),
      paid: checkbox,
      paidAt: optionalDate,
      /** Optional: total actually charged in the project's base currency (bank/PayPal). */
      chargedBaseCents: optionalMoney,
    })
    .superRefine((d, ctx) => {
      if (!d.paid) return;
      if (d.actualCostCents === undefined) {
        ctx.addIssue({ code: "custom", path: ["actualCostCents"], message: v.paidAmount });
      }
      if (!d.paidAt) {
        ctx.addIssue({ code: "custom", path: ["paidAt"], message: v.paidWhen });
      } else if (d.paidAt.getTime() > Date.now() + 86_400_000) {
        ctx.addIssue({ code: "custom", path: ["paidAt"], message: v.paidFuture });
      }
    });

  const shoppingItem = z.object({
    name: requiredText(120, t.shopping.item),
    category,
    projectId: z.preprocess(blankToUndefined, z.string().cuid().optional()),
    supplier: optionalText(120),
    url: optionalUrl,
    quantity,
    currency,
    estimatedCostCents: optionalMoney,
    notes: optionalText(2000),
  });

  const reference = z.object({
    caption: optionalText(200),
    sourceUrl: optionalUrl,
    groupName: optionalText(40),
  });

  return { project, part, shoppingItem, reference };
}

type Schemas = ReturnType<typeof schemas>;
export type ProjectInput = z.infer<Schemas["project"]>;
export type PartInput = z.infer<Schemas["part"]>;
export type ShoppingItemInput = z.infer<Schemas["shoppingItem"]>;

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

export function errorState(error: z.ZodError, t: Dict): FormState {
  return {
    ok: false,
    message: t.common.fixFields,
    errors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
