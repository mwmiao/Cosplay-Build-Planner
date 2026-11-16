import { NextResponse } from "next/server";
import { getPublicProject } from "@/lib/community/view";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Public detail of one published project: only the public representation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = idSchema.safeParse(id).success ? await getPublicProject(id) : null;
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
}
