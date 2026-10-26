import { NextResponse } from "next/server";
import { COMMUNITY_SORTS, type CommunitySort, listPublicProjects } from "@/lib/community/view";

export const dynamic = "force-dynamic";

/** Public list of published projects (same data as the Community page). */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const requested = params.get("sort");
  const sort: CommunitySort = (COMMUNITY_SORTS as readonly (string | null)[]).includes(requested) ? (requested as CommunitySort) : "newest";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const result = await listPublicProjects({ q: params.get("q") ?? undefined, sort, page });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
