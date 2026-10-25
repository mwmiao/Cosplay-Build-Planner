import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mimeForPath, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Private reference images. Knowing the URL isn't enough: the file must belong
 * to an image record in a project owned by the signed-in user.
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rel = params.path.join("/");
  const full = resolveUploadPath(rel);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owned = await db.referenceImage.findFirst({
    where: { OR: [{ filePath: rel }, { thumbPath: rel }], project: { ownerId: user.id, deletedAt: null } },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeForPath(full),
        // File names are random UUIDs, so they never change; "private" keeps them out of shared caches.
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
