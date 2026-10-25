import type { BuildPart, Project } from "@prisma/client";
import { type RateTable, crossRate } from "./rates";

export type MoneyContext = {
  /** App-wide base currency (projects without their own, shopping list) */
  defaultCurrency: string;
  /** Current rates, used only for estimates of unpaid costs */
  rates: RateTable;
};

type PartMoney = Pick<
  BuildPart,
  "status" | "currency" | "estimatedCostCents" | "actualCostCents" | "quantity" | "paidAt" | "paidBaseCents"
>;

export function projectCurrency(project: Pick<Project, "currency">, ctx: MoneyContext): string {
  return project.currency ?? ctx.defaultCurrency;
}

/**
 * Budget figures in the project's base currency.
 *
 * - paid: sum of stored conversions (rate of each payment date; never redone)
 * - planned: unpaid parts (actual if entered, else estimate) at today's rate, an estimate
 * - remaining: budget − paid
 * - overUnder: budget − (paid + planned); negative means over budget
 */
export function projectStats(
  project: Pick<Project, "status" | "budgetCents" | "currency">,
  parts: PartMoney[],
  ctx: MoneyContext,
) {
  const base = projectCurrency(project, ctx);
  let paid = 0;
  let paidCount = 0;
  let planned = 0;
  let plannedConverted = false;
  const missingRates = new Set<string>();
  let done = 0;

  for (const p of parts) {
    if (p.status === "done") done += 1;
    if (p.paidAt && p.paidBaseCents !== null) {
      paid += p.paidBaseCents;
      paidCount += 1;
      continue;
    }
    const each = p.actualCostCents ?? p.estimatedCostCents;
    if (each === null) continue;
    const cur = p.currency ?? base;
    const rate = crossRate(ctx.rates, cur, base);
    if (rate === null) {
      missingRates.add(cur);
      continue;
    }
    if (cur !== base) plannedConverted = true;
    planned += Math.round(each * p.quantity * rate);
  }

  const count = parts.length;
  const completion =
    project.status === "finished" ? 100 : count === 0 ? 0 : Math.round((done / count) * 100);
  const projected = paid + planned;
  const budget = project.budgetCents;

  return {
    base,
    paid,
    paidCount,
    planned,
    plannedConverted,
    missingRates: [...missingRates],
    projected,
    budget,
    remaining: budget === null ? null : budget - paid,
    overUnder: budget === null ? null : budget - projected,
    done,
    count,
    completion,
  };
}

export type ProjectStats = ReturnType<typeof projectStats>;

/** Prisma filter for the user's projects that are neither archived nor deleted. */
export function activeProjectsOf(userId: string) {
  return { ownerId: userId, deletedAt: null, archivedAt: null } as const;
}
