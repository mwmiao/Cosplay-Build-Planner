import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
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
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const group = parseGroup(params.get("group") ?? undefined);
  const [items, ctx] = await Promise.all([loadShoppingItems(params.get("show") === "all"), getMoneyContext()]);
  const base = ctx.defaultCurrency;

  const rows: (string | number)[][] = [
    [
      "Group",
      "Purchased",
      "Item",
      "Quantity",
      "Category",
      "Supplier",
      "Project",
      "Currency",
      "Est. each",
      "Est. total",
      `Est. total (${base}, today's rate)`,
      "Link",
      "Notes",
    ],
  ];
  for (const [name, list] of groupItems(items, group)) {
    for (const i of list) {
      const cur = itemCurrency(i, ctx);
      const rate = crossRate(ctx.rates, cur, base);
      rows.push([
        name,
        i.purchased ? "yes" : "no",
        i.name,
        i.quantity,
        categoryLabel(i.category),
        i.supplier ?? "",
        i.project?.characterName ?? "General",
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
  rows.push([`Still to buy (est., ${base})`, centsToDecimal(open.total)]);
  rows.push(["Today's rates", ctx.rates.source ?? "none cached", ctx.rates.rateDate ?? ""]);
  if (open.missing.length) rows.push(["Not included (no rate)", open.missing.join(" ")]);

  return csvResponse(`shopping-list-${today()}.csv`, rows);
}
