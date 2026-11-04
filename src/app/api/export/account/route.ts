import { NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { buildAccountExport } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/csv";
import { getMoneyContext } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** All of the signed-in person's own data as JSON (accounts only; guests export single projects). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await buildAccountExport(user.id, await getMoneyContext(user.id), getI18n().t);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cosplay-build-planner-account-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
