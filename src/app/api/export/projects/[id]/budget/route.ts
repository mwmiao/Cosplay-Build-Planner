import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { categoryLabel, statusLabel } from "@/lib/constants";
import { centsToDecimal, csvResponse, today } from "@/lib/csv";
import { db } from "@/lib/db";
import { projectStats } from "@/lib/projects";
import { getMoneyContext } from "@/lib/queries";
import { crossRate } from "@/lib/rates";
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

  const ctx = await getMoneyContext();
  const stats = projectStats(project, project.parts, ctx);
  const base = stats.base;

  const rows: (string | number)[][] = [
    [
      "Part",
      "Category",
      "Status",
      "Quantity",
      "Currency",
      "Est. each",
      "Est. total",
      "Actual each",
      "Actual total",
      "Paid",
      "Paid on",
      `Paid (${base})`,
      "FX rate",
      "Rate date",
      "Rate source",
      "Conversion",
      `Planned (${base}, today's rate)`,
      "Supplier",
      "Link",
      "Notes",
    ],
    ...project.parts.map((p) => {
      const cur = p.currency ?? base;
      const paid = p.paidAt !== null && p.paidBaseCents !== null;
      const each = p.actualCostCents ?? p.estimatedCostCents;
      const rate = crossRate(ctx.rates, cur, base);
      const planned = !paid && each !== null && rate !== null ? Math.round(each * p.quantity * rate) : null;
      return [
        p.name,
        categoryLabel(p.category),
        statusLabel(p.status),
        p.quantity,
        cur,
        centsToDecimal(p.estimatedCostCents),
        p.estimatedCostCents === null ? "" : centsToDecimal(p.estimatedCostCents * p.quantity),
        centsToDecimal(p.actualCostCents),
        p.actualCostCents === null ? "" : centsToDecimal(p.actualCostCents * p.quantity),
        paid ? "yes" : "no",
        p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
        paid ? centsToDecimal(p.paidBaseCents) : "",
        paid && p.fxRate !== null ? p.fxRate : "",
        paid ? (p.fxRateDate ?? "") : "",
        paid ? (p.fxSource ?? "") : "",
        paid ? (p.fxManual ? "manual" : "automatic") : "",
        centsToDecimal(planned),
        p.supplier ?? "",
        p.url ?? "",
        p.notes ?? "",
      ];
    }),
    [],
    [`Totals (${base})`],
    ["Paid", centsToDecimal(stats.paid)],
    ["Planned (estimate)", centsToDecimal(stats.planned)],
    ["Projected total", centsToDecimal(stats.projected)],
    ["Budget", centsToDecimal(stats.budget)],
    ["Remaining (budget − paid)", centsToDecimal(stats.remaining)],
    ["Over (−) / under (+) budget", centsToDecimal(stats.overUnder)],
    [],
    ["Today's rates", ctx.rates.source ?? "none cached", ctx.rates.rateDate ?? ""],
    ...(stats.missingRates.length ? [["Planned costs without a rate (excluded)", stats.missingRates.join(" ")]] : []),
  ];

  const slug = project.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return csvResponse(`${slug}-budget-${today()}.csv`, rows);
}
