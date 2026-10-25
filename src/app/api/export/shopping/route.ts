import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { categoryLabel } from "@/lib/constants";
import { centsToDecimal, csvResponse, today } from "@/lib/csv";
import { getMoneyContext } from "@/lib/queries";
import { crossRate } from "@/lib/rates";
import {
  convertedTotal,
  groupItems,
  itemCurrency,
  itemTotal,
  loadShoppingItems,
  parseGroup,
} from "@/lib/shoppingList";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { t } = getI18n();
  const c = t.csv;
  const params = new URL(req.url).searchParams;
  const group = parseGroup(params.get("group") ?? undefined);
  const [items, ctx] = await Promise.all([
    loadShoppingItems(user.id, params.get("show") === "all"),
    getMoneyContext(user.id),
  ]);
  const base = ctx.defaultCurrency;

  const rows: (string | number)[][] = [
    [
      c.group,
      c.purchased,
      c.item,
      c.quantity,
      c.category,
      c.supplier,
      c.project,
      c.currency,
      c.estEach,
      c.estTotal,
      c.estTotalIn(base),
      c.link,
      c.notes,
    ],
  ];
  for (const [name, list] of groupItems(items, group, t)) {
    for (const i of list) {
      const cur = itemCurrency(i, ctx);
      const rate = crossRate(ctx.rates, cur, base);
      rows.push([
        name,
        i.purchased ? c.yes : c.no,
        i.name,
        i.quantity,
        categoryLabel(i.category, t),
        i.supplier ?? "",
        i.project?.characterName ?? t.common.general,
        cur,
        centsToDecimal(i.estimatedCostCents),
        i.estimatedCostCents === null ? "" : centsToDecimal(itemTotal(i)),
        i.estimatedCostCents === null || rate === null ? "" : centsToDecimal(Math.round(itemTotal(i) * rate)),
        i.url ?? "",
        i.notes ?? "",
      ]);
    }
  }
  const open = convertedTotal(
    items.filter((i) => !i.purchased),
    ctx,
  );
  rows.push([]);
  rows.push([c.stillToBuy(base), centsToDecimal(open.total)]);
  rows.push([c.todaysRates, ctx.rates.source ?? c.noneCached, ctx.rates.rateDate ?? ""]);
  if (open.missing.length) rows.push([c.notIncluded, open.missing.join(" ")]);

  return csvResponse(`${c.shoppingFile}-${today()}.csv`, rows);
}
