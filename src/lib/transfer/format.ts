// Project export/import file format (JSON, canonical).
//
// {
//   "format": "cosplay-build-planner/project",
//   "schemaVersion": 1,
//   "exportedAt": "2026-10-26T09:00:00.000Z",
//   "app": { "name": "Cosplay Build Planner", "version": "1.2.1" },
//   "project": { id, characterName, series, conventionName, startDate, deadline, status,
//                currency (base), budgetCents, notes, archived, createdAt, updatedAt },
//   "categories": [{ code, label }],          // categories used by the parts
//   "parts": [{ id (stable expense id), name, category, status, currency,   (in manual order)
//               quantity, estimatedCostCents, actualCostCents, supplier, url,
//               notes, completedAt, createdAt, updatedAt,
//               payment: null | { paidAt, baseCurrency, baseAmountCents,
//                                 fxRate, fxRateDate, fxSource, fxManual } }],
//   "shoppingItems": [...],                   // items added by hand to this project
//   "references": [...],                      // image metadata only (files not included):
//                                             // caption, sourceUrl, originalName, kind, group, createdAt
//   "totals": { ... }                         // informational, ignored on import
// }
//
// Money is integer minor units ×100 ("cents") in the stated currency.
// Dates are YYYY-MM-DD; timestamps are ISO 8601.

import { z } from "zod";
import { PART_STATUSES, PROJECT_STATUSES } from "../constants";
import { isCurrency } from "../currencies";

export const EXPORT_FORMAT = "cosplay-build-planner/project";
export const EXPORT_SCHEMA_VERSION = 1;
export const MAX_ROWS = 5000;

/** Custom issue keys; translated for display by formatIssue(). */
export type IssueKey =
  | "currency"
  | "date"
  | "timestamp"
  | "amount"
  | "id"
  | "url"
  | "duplicateId"
  | "paymentCurrency"
  | "paymentOriginal";

const issue = (key: IssueKey) => ({ params: { key } });

const stableId = z.string().refine((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s), issue("id"));
const currency = z.string().refine((s): boolean => isCurrency(s), issue("currency"));
const cents = z.number().refine((n) => Number.isInteger(n) && n >= 0 && n <= 100_000_000, issue("amount"));
const dateOnly = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), issue("date"));
const timestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), issue("timestamp"));
const text = (max: number) => z.string().max(max);
const optionalUrl = z
  .string()
  .max(2000)
  .refine((u) => {
    try {
      return /^https?:$/.test(new URL(u).protocol);
    } catch {
      return false;
    }
  }, issue("url"))
  .nullable();

const paymentSchema = z.object({
  paidAt: dateOnly,
  baseCurrency: currency,
  baseAmountCents: cents,
  fxRate: z.number().positive().finite().nullable(),
  fxRateDate: dateOnly.nullable(),
  fxSource: text(200).nullable(),
  fxManual: z.boolean(),
});

const partSchema = z.object({
  id: stableId,
  name: z.string().trim().min(1).max(120),
  category: text(40),
  status: z.enum(PART_STATUSES),
  currency,
  quantity: z.number().int().min(1).max(9999),
  estimatedCostCents: cents.nullable(),
  actualCostCents: cents.nullable(),
  supplier: text(120).nullable(),
  url: optionalUrl,
  notes: text(5000).nullable(),
  completedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp.optional(),
  payment: paymentSchema.nullable(),
});

const shoppingItemSchema = z.object({
  id: stableId,
  name: z.string().trim().min(1).max(120),
  category: text(40),
  supplier: text(120).nullable(),
  url: optionalUrl,
  quantity: z.number().int().min(1).max(9999),
  currency,
  estimatedCostCents: cents.nullable(),
  notes: text(2000).nullable(),
  purchased: z.boolean(),
  purchasedAt: timestamp.nullable(),
  createdAt: timestamp,
});

const referenceSchema = z.object({
  caption: text(200).nullable(),
  sourceUrl: text(2000).nullable(),
  originalName: text(200),
  /** reference | part | cover (added in 1.5; optional for older files) */
  kind: text(20).optional(),
  group: text(40).nullable().optional(),
  createdAt: timestamp,
});

export const exportFileSchema = z
  .object({
    format: z.literal(EXPORT_FORMAT),
    schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
    exportedAt: timestamp,
    app: z.object({ name: z.string(), version: z.string() }).partial().optional(),
    project: z.object({
      id: stableId.optional(),
      characterName: z.string().trim().min(1).max(120),
      series: text(120).nullable(),
      conventionName: text(120).nullable(),
      /** Added in 1.5; optional for older files */
      startDate: dateOnly.nullable().optional(),
      deadline: dateOnly.nullable(),
      status: z.enum(PROJECT_STATUSES),
      currency,
      budgetCents: cents.nullable(),
      notes: text(5000).nullable(),
      archived: z.boolean().optional(),
      createdAt: timestamp.optional(),
      updatedAt: timestamp.optional(),
    }),
    categories: z.array(z.object({ code: z.string(), label: z.string() })).optional(),
    parts: z.array(partSchema).max(MAX_ROWS),
    shoppingItems: z.array(shoppingItemSchema).max(MAX_ROWS).default([]),
    references: z.array(referenceSchema).max(MAX_ROWS).default([]),
    totals: z.unknown().optional(),
  })
  .superRefine((file, ctx) => {
    // Duplicate IDs are checked by findDuplicateIds() so they're reported even when other fields fail.
    file.parts.forEach((p, i) => {
      if (p.payment) {
        // Stored conversions are in the project's base currency; anything else can't be preserved exactly.
        if (p.payment.baseCurrency !== file.project.currency) {
          ctx.addIssue({ code: "custom", path: ["parts", i, "payment", "baseCurrency"], ...issue("paymentCurrency") });
        }
        if (p.actualCostCents === null) {
          ctx.addIssue({ code: "custom", path: ["parts", i, "actualCostCents"], ...issue("paymentOriginal") });
        }
      }
    });
  });

/** Duplicate stable IDs in the raw file, as [section, index] pairs (runs before/independently of schema checks). */
export function findDuplicateIds(raw: unknown): [string, number][] {
  const out: [string, number][] = [];
  for (const section of ["parts", "shoppingItems"] as const) {
    const list = (raw as Record<string, unknown> | null)?.[section];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    list.forEach((row, i) => {
      const id = (row as { id?: unknown } | null)?.id;
      if (typeof id !== "string") return;
      if (seen.has(id)) out.push([section, i]);
      seen.add(id);
    });
  }
  return out;
}

export type ExportFile = z.infer<typeof exportFileSchema>;
export type ExportPart = ExportFile["parts"][number];
export type ExportShoppingItem = ExportFile["shoppingItems"][number];
