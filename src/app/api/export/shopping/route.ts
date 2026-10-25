import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { categoryLabel } from "@/lib/constants";
import { centsToDecimal, csvResponse, today } from "@/lib/csv";
import { groupItems, itemTotal, loadShoppingItems, parseGroup } from "@/lib/shoppingList";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const group = parseGroup(params.get("group") ?? undefined);
  const items = await loadShoppingItems(params.get("show") === "all");

  const rows: (string | number)[][] = [
    ["Group", "Purchased", "Item", "Quantity", "Category", "Supplier", "Project", "Est. each", "Est. total", "Link", "Notes"],
  ];
  let total = 0;
  for (const [name, list] of groupItems(items, group)) {
    for (const i of list) {
      if (!i.purchased) total += itemTotal(i);
      rows.push([
        name,
        i.purchased ? "yes" : "no",
        i.name,
        i.quantity,
        categoryLabel(i.category),
        i.supplier ?? "",
        i.project?.characterName ?? "General",
        centsToDecimal(i.estimatedCostCents),
        i.estimatedCostCents === null ? "" : centsToDecimal(itemTotal(i)),
        i.url ?? "",
        i.notes ?? "",
      ]);
    }
  }
  rows.push([]);
  rows.push(["", "", "Still to buy (est.)", "", "", "", "", "", centsToDecimal(total)]);

  return csvResponse(`shopping-list-${today()}.csv`, rows);
}
