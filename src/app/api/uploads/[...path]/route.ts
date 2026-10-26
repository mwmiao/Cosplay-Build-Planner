import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { decryptBytes } from "@/lib/crypto";
import { db } from "@/lib/db";
import { guestKey } from "@/lib/guest";
import { mimeForPath, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Private project images. Knowing the URL isn't enough: the file must belong
 * to an image record in a project owned by the signed-in user. Guest images
 * are stored encrypted and decrypted here with the key from the guest's own
 * cookie (the server never stores that key).
 */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rel = params.path.join("/");
  const full = resolveUploadPath(rel);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const image = await db.referenceImage.findFirst({
    where: { OR: [{ filePath: rel }, { thumbPath: rel }], project: { ownerId: user.id, deletedAt: null } },
    select: { thumbPath: true, mimeType: true, encrypted: true },
  });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    let data = await readFile(full);
    let type = mimeForPath(full);
    if (image.encrypted) {
      const key = guestKey();
      if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
      data = decryptBytes(data, key);
      type = rel === image.thumbPath ? "image/webp" : image.mimeType;
    }
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
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
