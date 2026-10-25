import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { categoryLabel, statusLabel } from "@/lib/constants";
import { centsToDecimal, csvResponse, today } from "@/lib/csv";
import { db } from "@/lib/db";
import { projectStats } from "@/lib/projects";
import { getMoneyContext } from "@/lib/queries";
import { crossRate } from "@/lib/rates";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await db.project.findFirst({
    where: { id: id.data, ownerId: user.id, deletedAt: null },
    include: { parts: { where: { deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { t } = getI18n();
  const c = t.csv;
  const ctx = await getMoneyContext(user.id);
  const stats = projectStats(project, project.parts, ctx);
  const base = stats.base;

  const rows: (string | number)[][] = [
    [
      c.part,
      c.category,
      c.status,
      c.quantity,
      c.currency,
      c.estEach,
      c.estTotal,
      c.actualEach,
      c.actualTotal,
      c.paid,
      c.paidOn,
      c.paidIn(base),
      c.fxRate,
      c.rateDate,
      c.rateSource,
      c.conversion,
      c.plannedIn(base),
      c.supplier,
      c.link,
      c.notes,
    ],
    ...project.parts.map((p) => {
      const cur = p.currency ?? base;
      const paid = p.paidAt !== null && p.paidBaseCents !== null;
      const each = p.actualCostCents ?? p.estimatedCostCents;
      const rate = crossRate(ctx.rates, cur, base);
      const planned = !paid && each !== null && rate !== null ? Math.round(each * p.quantity * rate) : null;
      return [
        p.name,
        categoryLabel(p.category, t),
        statusLabel(p.status, t),
        p.quantity,
        cur,
        centsToDecimal(p.estimatedCostCents),
        p.estimatedCostCents === null ? "" : centsToDecimal(p.estimatedCostCents * p.quantity),
        centsToDecimal(p.actualCostCents),
        p.actualCostCents === null ? "" : centsToDecimal(p.actualCostCents * p.quantity),
        paid ? c.yes : c.no,
        p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
        paid ? centsToDecimal(p.paidBaseCents) : "",
        paid && p.fxRate !== null ? p.fxRate : "",
        paid ? (p.fxRateDate ?? "") : "",
        paid ? (p.fxSource ? (t.conversion.sources[p.fxSource] ?? p.fxSource) : "") : "",
        paid ? (p.fxManual ? t.conversion.manual : t.conversion.automatic) : "",
        centsToDecimal(planned),
        p.supplier ?? "",
        p.url ?? "",
        p.notes ?? "",
      ];
    }),
    [],
    [c.totals(base)],
    [c.paid, centsToDecimal(stats.paid)],
    [c.plannedEstimate, centsToDecimal(stats.planned)],
    [c.projected, centsToDecimal(stats.projected)],
    [c.budget, centsToDecimal(stats.budget)],
    [c.remaining, centsToDecimal(stats.remaining)],
    [c.overUnder, centsToDecimal(stats.overUnder)],
    [],
    [c.todaysRates, ctx.rates.source ?? c.noneCached, ctx.rates.rateDate ?? ""],
    ...(stats.missingRates.length ? [[c.noRateExcluded, stats.missingRates.join(" ")]] : []),
  ];

  const slug = project.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return csvResponse(`${slug}-${c.budgetFile}-${today()}.csv`, rows);
}
