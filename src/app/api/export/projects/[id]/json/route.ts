import { NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/csv";
import { getMoneyContext } from "@/lib/queries";
import { buildProjectExport } from "@/lib/transfer/export";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Canonical project export (JSON). Re-import it via Projects → Import. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { t } = getI18n();
  const data = await buildProjectExport(id.data, user.id, await getMoneyContext(user.id), t);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug =
    data.project.characterName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${today()}.cosplay.json"`,
      "Cache-Control": "no-store",
    },
  });
}
