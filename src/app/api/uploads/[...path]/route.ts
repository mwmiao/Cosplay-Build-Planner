import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { mimeForPath, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rel = params.path.join("/");
  const full = resolveUploadPath(rel);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeForPath(full),
        // File names are random UUIDs, so they never change.
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
