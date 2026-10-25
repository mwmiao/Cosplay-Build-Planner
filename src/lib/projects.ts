import type { BuildPart, Project } from "@prisma/client";

type PartCosts = Pick<
  BuildPart,
  "status" | "estimatedCostCents" | "actualCostCents" | "quantity"
>;

export function partTotals(parts: PartCosts[]) {
  let estimated = 0;
  let actual = 0;
  let done = 0;
  for (const p of parts) {
    estimated += (p.estimatedCostCents ?? 0) * p.quantity;
    actual += (p.actualCostCents ?? 0) * p.quantity;
    if (p.status === "done") done += 1;
  }
  return { estimated, actual, done, count: parts.length };
}

export function projectStats(project: Pick<Project, "status" | "spentCents" | "budgetCents">, parts: PartCosts[]) {
  const totals = partTotals(parts);
  const completion =
    project.status === "finished"
      ? 100
      : totals.count === 0
        ? 0
        : Math.round((totals.done / totals.count) * 100);
  const spent = project.spentCents ?? totals.actual;
  const remainingBudget = project.budgetCents === null ? null : project.budgetCents - spent;
  return { ...totals, completion, spent, spentIsManual: project.spentCents !== null, remainingBudget };
}

/** Prisma filter for projects that are neither archived nor deleted. */
export const activeProjectWhere = { deletedAt: null, archivedAt: null } as const;
