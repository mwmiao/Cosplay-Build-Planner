import "server-only";
import type { Dict } from "@/i18n";
import pkg from "../../../package.json";
import { CATEGORIES, categoryLabel } from "../constants";
import { db } from "../db";
import { type MoneyContext, projectCurrency, projectStats } from "../projects";
import { EXPORT_FORMAT, EXPORT_SCHEMA_VERSION, type ExportFile } from "./format";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Builds the canonical JSON export of one of the user's projects (null if it
 * doesn't exist or isn't theirs). Contains no account data (owner, email, ids of users).
 */
export async function buildProjectExport(
  projectId: string,
  userId: string,
  ctx: MoneyContext,
  t: Dict,
): Promise<ExportFile | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: userId, deletedAt: null },
    include: {
      parts: { where: { deletedAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      // Part-linked items are rebuilt from their parts on import.
      shoppingItems: { where: { deletedAt: null, partId: null }, orderBy: { createdAt: "asc" } },
      references: { orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!project) return null;

  const base = projectCurrency(project, ctx);
  const stats = projectStats(project, project.parts, ctx);
  const usedCategories = CATEGORIES.filter((c) => project.parts.some((p) => p.category === c));

  return {
    format: EXPORT_FORMAT,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: "Cosplay Build Planner", version: process.env.APP_VERSION ?? pkg.version },
    project: {
      id: project.id,
      characterName: project.characterName,
      series: project.series,
      conventionName: project.conventionName,
      startDate: day(project.startDate),
      deadline: day(project.deadline),
      status: project.status as ExportFile["project"]["status"],
      currency: base,
      budgetCents: project.budgetCents,
      notes: project.notes,
      archived: project.archivedAt !== null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    categories: usedCategories.map((code) => ({ code, label: categoryLabel(code, t) })),
    parts: project.parts.map((p) => ({
      id: p.uid,
      name: p.name,
      category: p.category,
      status: p.status as ExportFile["parts"][number]["status"],
      currency: p.currency ?? base,
      quantity: p.quantity,
      estimatedCostCents: p.estimatedCostCents,
      actualCostCents: p.actualCostCents,
      supplier: p.supplier,
      url: p.url,
      notes: p.notes,
      completedAt: iso(p.completedAt),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      payment:
        p.paidAt && p.paidBaseCents !== null
          ? {
              paidAt: day(p.paidAt) as string,
              baseCurrency: base,
              baseAmountCents: p.paidBaseCents,
              fxRate: p.fxRate,
              fxRateDate: p.fxRateDate,
              fxSource: p.fxSource,
              fxManual: p.fxManual,
            }
          : null,
    })),
    shoppingItems: project.shoppingItems.map((s) => ({
      id: s.uid,
      name: s.name,
      category: s.category,
      supplier: s.supplier,
      url: s.url,
      quantity: s.quantity,
      currency: s.currency ?? base,
      estimatedCostCents: s.estimatedCostCents,
      notes: s.notes,
      purchased: s.purchased,
      purchasedAt: iso(s.purchasedAt),
      createdAt: s.createdAt.toISOString(),
    })),
    references: project.references.map((r) => ({
      caption: r.caption,
      sourceUrl: r.sourceUrl,
      originalName: r.originalName,
      kind: r.kind,
      group: r.groupName,
      createdAt: r.createdAt.toISOString(),
    })),
    totals: {
      baseCurrency: base,
      paidCents: stats.paid,
      plannedCentsAtExport: stats.planned,
      budgetCents: stats.budget,
      ratesDate: ctx.rates.rateDate,
      note: "Informational only; ignored on import.",
    },
  };
}
