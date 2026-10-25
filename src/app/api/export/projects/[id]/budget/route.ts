import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { categoryLabel, statusLabel } from "@/lib/constants";
import { centsToDecimal, csvResponse, today } from "@/lib/csv";
import { db } from "@/lib/db";
import { projectStats } from "@/lib/projects";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = idSchema.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await db.project.findFirst({
    where: { id: id.data, deletedAt: null },
    include: { parts: { where: { deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stats = projectStats(project, project.parts);
  const rows: (string | number)[][] = [
    ["Part", "Category", "Status", "Quantity", "Est. each", "Est. total", "Actual each", "Actual total", "Supplier", "Link", "Notes"],
    ...project.parts.map((p) => [
      p.name,
      categoryLabel(p.category),
      statusLabel(p.status),
      p.quantity,
      centsToDecimal(p.estimatedCostCents),
      p.estimatedCostCents === null ? "" : centsToDecimal(p.estimatedCostCents * p.quantity),
      centsToDecimal(p.actualCostCents),
      p.actualCostCents === null ? "" : centsToDecimal(p.actualCostCents * p.quantity),
      p.supplier ?? "",
      p.url ?? "",
      p.notes ?? "",
    ]),
    [],
    ["Totals", "", "", "", "", centsToDecimal(stats.estimated), "", centsToDecimal(stats.actual)],
    ["Budget", "", "", "", "", "", "", centsToDecimal(project.budgetCents)],
    ["Total spent", "", "", "", "", "", "", centsToDecimal(stats.spent), stats.spentIsManual ? "(entered manually)" : ""],
    ["Remaining", "", "", "", "", "", "", centsToDecimal(stats.remainingBudget)],
  ];

  const slug = project.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return csvResponse(`${slug}-budget-${today()}.csv`, rows);
}
