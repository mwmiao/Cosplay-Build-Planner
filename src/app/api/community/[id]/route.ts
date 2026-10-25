import { NextResponse } from "next/server";
import { getPublicProject } from "@/lib/community/view";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Public detail of one published project: only the public representation. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = idSchema.safeParse(params.id).success ? await getPublicProject(params.id) : null;
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project, { headers: { "Cache-Control": "no-store" } });
}
