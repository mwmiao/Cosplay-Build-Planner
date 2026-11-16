import { z } from "zod";
import type { Dict } from "@/i18n";
import { CATEGORIES, PART_STATUSES, PROJECT_STATUSES } from "./constants";
import { CURRENCY_CODES } from "./currencies";

/** Turns blank form strings into undefined so optional fields stay optional. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v;

/** HTML checkbox: "on" when ticked, missing when not. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/**
 * "12.5" / "12,50" / "1.500" / "1,234.56" / "1.234,56" → cents (NaN when unreadable).
 * A lone separator followed by exactly three digits (and a non-zero whole part) is a
 * thousands separator; otherwise the last separator is the decimal point.
 */
export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, "");
  if (cleaned === "") return Number.NaN;
  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "");
  const lastSep = Math.max(body.lastIndexOf("."), body.lastIndexOf(","));
  let normalized: string;
  if (lastSep === -1) {
    normalized = body;
  } else {
    const whole = body.slice(0, lastSep).replace(/[.,]/g, "");
    const frac = body.slice(lastSep + 1);
    const sepCount = (body.match(/[.,]/g) ?? []).length;
    const mixed = body.includes(".") && body.includes(",");
    // "1.234.567" or "1.500": only thousands separators, no decimals.
    const thousandsOnly = !mixed && (sepCount > 1 || (frac.length === 3 && whole !== "" && whole !== "0"));
    normalized = thousandsOnly ? body.replace(/[.,]/g, "") : `${whole}.${frac}`;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round((negative ? -n : n) * 100) : Number.NaN;
}

/** Form schemas with error messages in the user's language. */
export function schemas(t: Dict) {
  const v = t.validation;

  const optionalText = (max: number) =>
    z.preprocess(blankToUndefined, z.string().max(max, v.tooLong(max)).optional());

  const requiredText = (max: number, label: string) =>
    z
      .string({ error: (iss) => (iss.input === undefined ? v.required(label) : undefined) })
      .trim()
      .min(1, v.required(label))
      .max(max, v.tooLong(max));

  /** "12.5" / "12,50" / "£12.50" → 1250 cents. */
  const optionalMoney = z.preprocess(
    (val) => {
      const s = blankToUndefined(val);
      if (s === undefined) return undefined;
      if (typeof s !== "string") return s;
      return parseMoneyToCents(s);
    },
    z
      .number({ error: (iss) => (iss.input === undefined ? undefined : v.amount) })
      .int()
      .min(0, v.negative)
      .max(1_000_000_000, v.tooLarge)
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

  const currency = z.enum(CURRENCY_CODES, { error: () => v.pickCurrency });
  const category = z.enum(CATEGORIES, { error: () => v.pickCategory });

  const quantity = z.preprocess(
    (val) => blankToUndefined(val) ?? "1",
    z.coerce
      .number({ error: (iss) => (iss.input === undefined ? undefined : v.wholeNumber) })
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
      status: z.enum(PROJECT_STATUSES, { error: () => v.pickStatus }),
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
      status: z.enum(PART_STATUSES, { error: () => v.pickStatus }),
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
      if (d.actualCostCents !== undefined && d.actualCostCents * d.quantity > 2_147_483_647) {
        ctx.addIssue({ code: "custom", path: ["actualCostCents"], message: v.tooLarge });
      }
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

  /** Progress photo details: day it shows (defaults to today), optional caption and stage. */
  const progress = z.object({
    caption: optionalText(200),
    stage: optionalText(40),
    takenAt: optionalDate.refine((d) => !d || d.getTime() <= Date.now() + 86_400_000, v.paidFuture),
  });

  return { project, part, shoppingItem, reference, progress };
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
