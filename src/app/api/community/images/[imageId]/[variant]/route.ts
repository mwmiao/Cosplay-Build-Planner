import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolvePublicPath } from "@/lib/community/images";
import { db } from "@/lib/db";
import { mimeForPath } from "@/lib/uploads";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Published image copies only. The image must belong to a live publication;
 * after unpublishing (row deleted) this returns 404 even if a file lingered.
 */
export async function GET(_req: Request, { params }: { params: { imageId: string; variant: string } }) {
  if (!idSchema.safeParse(params.imageId).success || (params.variant !== "thumb" && params.variant !== "full")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const image = await db.publicImage.findFirst({
    where: { id: params.imageId, publication: { project: { deletedAt: null } } },
    select: { filePath: true, thumbPath: true },
  });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rel = params.variant === "thumb" ? image.thumbPath : image.filePath;
  const full = resolvePublicPath(rel);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeForPath(full),
        // Short cache so unpublishing takes effect quickly in browsers.
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
