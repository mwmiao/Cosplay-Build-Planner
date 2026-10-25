// The public representation of a published project.
//
// Built ONLY from the allow-list below. Private fields — notes, payments
// (dates, actual amounts, FX details), receipts, delivery details, owner
// account data — are never read into it. Schemas are .strict(), so any
// unexpected key makes publishing fail instead of leaking.

import type { BuildPart, Project } from "@prisma/client";
import { z } from "zod";
import { type MoneyContext, projectStats } from "../projects";

export const PUBLIC_SNAPSHOT_VERSION = 1;

const publicItemSchema = z
  .object({
    name: z.string(),
    category: z.string(),
    status: z.string(),
    quantity: z.number().int(),
    /** Only with "include item costs": the planned (estimated) cost per item. Actual spending is never shown. */
    estimatedEachCents: z.number().int().nullable().optional(),
    currency: z.string().optional(),
    /** Only with "include shop links" */
    supplier: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .strict();

export const publicSnapshotSchema = z
  .object({
    v: z.literal(PUBLIC_SNAPSHOT_VERSION),
    status: z.string(),
    progress: z.object({ done: z.number().int(), count: z.number().int(), percent: z.number().int() }).strict(),
    /** Only with "include budget totals" */
    budget: z
      .object({
        currency: z.string(),
        budgetCents: z.number().int().nullable(),
        spentCents: z.number().int(),
        plannedCents: z.number().int(),
      })
      .strict()
      .nullable(),
    items: z.array(publicItemSchema),
  })
  .strict();

export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;
export type PublicItem = z.infer<typeof publicItemSchema>;

export type PublishOptions = { includeBudget: boolean; includeCosts: boolean; includeLinks: boolean };

type PartFields = Pick<
  BuildPart,
  | "name"
  | "category"
  | "status"
  | "quantity"
  | "currency"
  | "estimatedCostCents"
  | "actualCostCents"
  | "supplier"
  | "url"
  | "paidAt"
  | "paidBaseCents"
>;

export function buildPublicSnapshot(
  project: Pick<Project, "status" | "budgetCents" | "currency">,
  parts: PartFields[],
  options: PublishOptions,
  ctx: MoneyContext,
): PublicSnapshot {
  const stats = projectStats(project, parts, ctx);
  const snapshot: PublicSnapshot = {
    v: PUBLIC_SNAPSHOT_VERSION,
    status: project.status,
    progress: { done: stats.done, count: stats.count, percent: stats.completion },
    budget: options.includeBudget
      ? { currency: stats.base, budgetCents: stats.budget, spentCents: stats.paid, plannedCents: stats.planned }
      : null,
    items: parts.map((p) => {
      const item: PublicItem = { name: p.name, category: p.category, status: p.status, quantity: p.quantity };
      if (options.includeCosts) {
        item.estimatedEachCents = p.estimatedCostCents;
        item.currency = p.currency ?? stats.base;
      }
      if (options.includeLinks) {
        item.supplier = p.supplier;
        item.url = p.url;
      }
      return item;
    }),
  };
  // Defence in depth: refuse to publish anything outside the allow-list.
  return publicSnapshotSchema.parse(snapshot);
}

export function parseSnapshot(json: string): PublicSnapshot {
  return publicSnapshotSchema.parse(JSON.parse(json));
}

export function parseTags(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}
