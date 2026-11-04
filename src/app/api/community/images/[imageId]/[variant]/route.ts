import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { parseIds } from "@/lib/community/view";
import { db } from "@/lib/db";
import { mimeForPath, resolveUploadPath } from "@/lib/uploads";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Images of published projects, checked on every request: the image must be a
 * main picture, reference image or (when the timeline is shown) progress photo
 * of a live project whose publication currently includes it. Part photos and
 * guests' encrypted images never are. Unpublishing, deleting the image or
 * switching it off makes this 404 immediately.
 */
export async function GET(req: Request, { params }: { params: { imageId: string; variant: string } }) {
  if (!idSchema.safeParse(params.imageId).success || (params.variant !== "thumb" && params.variant !== "full")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const image = await db.referenceImage.findFirst({
    where: {
      id: params.imageId,
      kind: { in: ["cover", "reference", "progress"] },
      encrypted: false,
      project: { deletedAt: null, publication: { is: { owner: { suspendedAt: null } } } },
    },
    select: {
      id: true,
      kind: true,
      filePath: true,
      thumbPath: true,
      project: { select: { publication: { select: { imageMode: true, selectedImageIds: true, includeProgress: true } } } },
    },
  });
  const pub = image?.project.publication;
  const allowed =
    image && pub
      ? image.kind === "progress"
        ? pub.includeProgress
        : pub.imageMode === "all" || parseIds(pub.selectedImageIds).includes(image.id)
      : false;
  if (!image || !allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const full = resolveUploadPath(params.variant === "thumb" ? image.thumbPath : image.filePath);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    // The publication check above runs on every request. The ETag only saves re-sending
    // the bytes: after the short cache expires, a browser that already has the file gets a 304.
    const { size, mtimeMs } = await stat(full);
    const etag = `"${size.toString(16)}-${Math.round(mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": mimeForPath(full),
      // Short cache so unpublishing or removing an image takes effect quickly in browsers.
      "Cache-Control": "public, max-age=60",
      ETag: etag,
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
